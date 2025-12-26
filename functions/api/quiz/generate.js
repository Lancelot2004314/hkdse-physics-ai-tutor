/**
 * Quiz Generation API
 * Generates MC, Short, and Long questions based on selected topics
 * With RAG: Injects real HKDSE past paper examples for style consistency
 */

import {
  QUIZ_MC_PROMPT,
  QUIZ_SHORT_PROMPT,
  QUIZ_LONG_PROMPT,
  QUIZ_MC_REWRITE_PROMPT,
  QUIZ_SHORT_REWRITE_PROMPT,
  QUIZ_LONG_REWRITE_PROMPT,
  QUIZ_VALIDATE_AND_FIX_PROMPT,
} from '../../../shared/prompts.js';
import { PHYSICS_TOPICS, getSubtopicNames } from '../../../shared/topics.js';
import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { saveTokenUsage } from '../../../shared/tokenUsage.js';
import { searchKnowledgeBase, enrichKbResultsWithMetadata } from '../../../shared/embedding.js';
import { checkVertexConfig } from '../../../shared/vertexRag.js';

const REQUEST_TIMEOUT = 120000; // 2 minutes for larger requests

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const {
      topics = [],
      mcCount = 0,
      shortCount = 0,
      longCount = 0,
      difficulty = 3,
      timeLimit = 60,
      language = 'zh',
      debug = false,
    } = body;

    // Validate
    if (topics.length === 0) {
      return errorResponse(400, 'Please select at least one topic');
    }

    const totalQuestions = mcCount + shortCount + longCount;
    if (totalQuestions === 0) {
      return errorResponse(400, 'Please specify at least one question');
    }

    if (totalQuestions > 50) {
      return errorResponse(400, 'Maximum 50 questions per quiz');
    }

    // Get user
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login to start a quiz');
    }

    // Check API key
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return errorResponse(500, 'Service not configured');
    }

    // Get topic names for prompt
    const topicNames = getSubtopicNames(topics, language === 'en' ? 'en' : 'zh');

    // Fetch prototype pack from knowledge base (real HKDSE examples)
    // Uses Vertex AI RAG Engine if configured, otherwise Vectorize
    let prototypePack = '';
    let kbBackend = 'none';
    let styleQuery = '';
    let kbSources = [];
    let kbResultsCount = 0;
    let selectedPrototypes = [];
    let usedRewriteMode = false;
    let detectedVisualInPrototype = false;

    try {
      const vertexConfig = checkVertexConfig(env);
      kbBackend = vertexConfig.configured ? 'vertex_rag' : (env.VECTORIZE ? 'vectorize' : 'none');

      if (kbBackend !== 'none') {
        // Search for relevant past paper examples based on topics
        // Use specific query terms to retrieve real exam-like prototypes + marking scheme style.
        styleQuery = `HKDSE Physics ${topicNames.slice(0, 3).join(' ')} DSE paper question marking scheme`;

        let kbResults = await searchKnowledgeBase(styleQuery, env, {
          topK: 18,
          // For Vertex RAG these are distance-like scores; we post-filter by doc_type instead.
          minScore: 0,
          filter: {
            subject: 'Physics',
            language: language === 'en' ? 'en' : 'zh',
          },
        });

        if (kbResults && kbResults.length > 0) {
          // Enrich Vertex results with D1 metadata (doc_type/year/paper/...)
          kbResults = await enrichKbResultsWithMetadata(env, kbResults);

          kbResultsCount = kbResults.length;
          kbSources = kbResults
            .map(r => r.sourceUri || r.gcs_uri || r.filename || r.title || '')
            .filter(Boolean)
            .slice(0, 12);

          const filtered = selectPrototypeCandidates(kbResults, language);
          const picked = pickPrototypePack(filtered);

          selectedPrototypes = picked.map(p => ({
            sourceUri: p.sourceUri || p.gcs_uri || null,
            docType: p.doc_type || p.docType || null,
            year: p.year || null,
            paper: p.paper || null,
            score: p.score ?? null,
          }));

          prototypePack = formatPrototypePack(picked, language);
          detectedVisualInPrototype = picked.some(p => looksLikeVisualQuestion(p.content || ''));
          usedRewriteMode = picked.length > 0;

          if (usedRewriteMode) {
            console.log(`Using prototype rewrite mode with ${picked.length} prototypes (backend: ${kbBackend})`);
          } else {
            console.log(`No suitable prototype candidates found, falling back to style-only generation`);
          }
        } else {
          console.log(`No KB results found for topics: ${topicNames.slice(0, 3).join(', ')}`);
        }
      }
    } catch (err) {
      console.warn('KB search for style context failed, continuing without:', err.message);
    }

    // Generate questions - run all types in PARALLEL for speed
    const allQuestions = [];
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Validation stats
    const validatorStats = {
      totalProcessed: 0,
      passedInitial: 0,
      repairedCount: 0,
      regeneratedCount: 0,
      droppedCount: 0,
      sampleIssues: [],
    };

    // Build parallel generation promises
    const generationTasks = [];

    const mcPrompt = usedRewriteMode ? QUIZ_MC_REWRITE_PROMPT : QUIZ_MC_PROMPT;
    const shortPrompt = usedRewriteMode ? QUIZ_SHORT_REWRITE_PROMPT : QUIZ_SHORT_PROMPT;
    const longPrompt = usedRewriteMode ? QUIZ_LONG_REWRITE_PROMPT : QUIZ_LONG_PROMPT;

    if (mcCount > 0) {
      generationTasks.push(
        generateQuestions(apiKey, mcPrompt, topicNames, difficulty, mcCount, language, prototypePack)
          .then(result => ({ type: 'mc', result, prompt: mcPrompt }))
      );
    }

    if (shortCount > 0) {
      generationTasks.push(
        generateQuestions(apiKey, shortPrompt, topicNames, difficulty, shortCount, language, prototypePack)
          .then(result => ({ type: 'short', result, prompt: shortPrompt }))
      );
    }

    if (longCount > 0) {
      generationTasks.push(
        generateQuestions(apiKey, longPrompt, topicNames, difficulty, longCount, language, prototypePack)
          .then(result => ({ type: 'long', result, prompt: longPrompt }))
      );
    }

    // Run all generation tasks in parallel
    const results = await Promise.all(generationTasks);

    // Process results in order: MC -> Short -> Long
    // Now with validation for each question type
    const typeOrder = ['mc', 'short', 'long'];
    for (const typeKey of typeOrder) {
      const entry = results.find(r => r.type === typeKey);
      if (entry && entry.result.success && entry.result.questions && entry.result.questions.length > 0) {
        // Validate and fix questions for this type
        const { questions: validatedQs, stats } = await validateAndProcessQuestions(
          apiKey,
          entry.result.questions,
          typeKey,
          language,
          entry.prompt,
          topicNames,
          difficulty,
          prototypePack
        );

        // Merge validation stats
        validatorStats.totalProcessed += stats.totalProcessed;
        validatorStats.passedInitial += stats.passedInitial;
        validatorStats.repairedCount += stats.repairedCount;
        validatorStats.regeneratedCount += stats.regeneratedCount;
        validatorStats.droppedCount += stats.droppedCount;
        if (stats.issues && stats.issues.length > 0) {
          validatorStats.sampleIssues.push(...stats.issues.slice(0, 3));
        }

        // Add validated questions
        validatedQs.forEach(q => {
          allQuestions.push({ ...q, type: typeKey, index: allQuestions.length });
        });

        if (entry.result.usage) {
          totalUsage.prompt_tokens += entry.result.usage.prompt_tokens || 0;
          totalUsage.completion_tokens += entry.result.usage.completion_tokens || 0;
          totalUsage.total_tokens += entry.result.usage.total_tokens || 0;
        }
      }
    }

    // Trim sample issues to max 5
    validatorStats.sampleIssues = validatorStats.sampleIssues.slice(0, 5);

    if (allQuestions.length === 0) {
      return errorResponse(500, 'Failed to generate questions');
    }

    // Calculate max score
    const maxScore = allQuestions.reduce((sum, q) => sum + (q.score || 1), 0);

    // Create session in database
    const sessionId = crypto.randomUUID();

    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO quiz_sessions (
          id, user_id, topics, mc_count, short_count, long_count,
          difficulty, time_limit, questions, max_score, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress')
      `).bind(
        sessionId,
        user.id,
        JSON.stringify(topics),
        mcCount,
        shortCount,
        longCount,
        difficulty,
        timeLimit,
        JSON.stringify(allQuestions),
        maxScore
      ).run();

      // Track token usage
      if (totalUsage.total_tokens > 0) {
        await saveTokenUsage(env.DB, user.id, 'deepseek', totalUsage, 'quiz-generate');
      }
    }

    // Return questions without answers for frontend
    // Also strip internal validation metadata
    const questionsForClient = allQuestions.map(q => {
      const { correctAnswer, modelAnswer, markingScheme, _validated, _wasRepaired, _repairAttempts, ...clientQ } = q;
      return clientQ;
    });

    const responsePayload = {
      sessionId,
      questions: questionsForClient,
      timeLimit,
      maxScore,
      totalQuestions: allQuestions.length,
      ragInfo: {
        kbBackend,
        rewriteMode: usedRewriteMode,
        kbResultsCount,
      },
    };

    // Optional debug payload (admin only) to verify RAG usage and validation stats
    if (debug === true && isAdmin(user.email, env)) {
      responsePayload.debug = {
        kbBackend,
        styleQuery: styleQuery || null,
        kbResultsCount,
        kbSources,
        rewriteMode: usedRewriteMode,
        selectedPrototypes,
        detectedVisualInPrototype,
        prototypePackExcerpt: prototypePack ? prototypePack.slice(0, 900) : null,
        // Validator stats
        validator: {
          totalProcessed: validatorStats.totalProcessed,
          passedInitial: validatorStats.passedInitial,
          repairedCount: validatorStats.repairedCount,
          regeneratedCount: validatorStats.regeneratedCount,
          droppedCount: validatorStats.droppedCount,
          sampleIssues: validatorStats.sampleIssues,
        },
        // Per-question validation metadata
        questionsValidation: allQuestions.map((q, i) => ({
          index: i,
          type: q.type,
          wasRepaired: q._wasRepaired || false,
          repairAttempts: q._repairAttempts || 0,
        })),
      };
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in quiz/generate:', err);
    return errorResponse(500, 'Failed to generate quiz');
  }
}

async function generateQuestions(apiKey, promptTemplate, topicNames, difficulty, count, language, styleContext = '') {
  const prompt = promptTemplate
    .replace('{topics}', topicNames.join(', '))
    .replace('{difficulty}', difficulty)
    .replace('{count}', count)
    .replace('{language}', language === 'en' ? 'English' : 'Traditional Chinese')
    .replace('{styleContext}', styleContext || '(No past paper examples available)');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an expert HKDSE Physics examiner. Generate exam-quality questions.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('DeepSeek error:', response.status);
      return { success: false, error: `API error (${response.status})` };
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';

    // Parse JSON from response
    let parsed;
    try {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonText = codeBlockMatch ? codeBlockMatch[1] : text;
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('Failed to parse questions:', parseErr);
      return { success: false, error: 'Failed to parse questions' };
    }

    return {
      success: true,
      questions: parsed?.questions || [],
      usage: data.usage,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('Question generation error:', err);
    return { success: false, error: err.message };
  }
}

// Validation constants
const MAX_REPAIR_ATTEMPTS = 2;
const MAX_REGEN_ATTEMPTS = 2;
const VALIDATION_TIMEOUT = 30000;

// Forbidden phrases that indicate LLM meta-commentary
const FORBIDDEN_PHRASES = [
  '修正', '假設', '為保持', '重新提供', '但此為正確答案',
  '實際上', '在實際生成中', '調整', '為符合', '為了保持原型一致',
  'in actual generation', 'to maintain', 'assuming', 'correction',
  'let me correct', 'i should note', 'note:', 'actually',
];

// Visual reference patterns that should not appear in answer/explanation
// (The question can mention data tables, but answers should not reference figures)
const VISUAL_ANSWER_PATTERNS = [
  /from the (?:graph|diagram|figure)/i,
  /as shown in (?:the )?(?:graph|diagram|figure)/i,
  /refer(?:ring)? to (?:the )?(?:graph|diagram|figure)/i,
  /see (?:the )?(?:graph|diagram|figure)/i,
  /根據(?:上)?圖/,
  /如(?:上|下)?圖所示/,
  /從圖中/,
  /參見(?:上|下)?圖/,
  /draw(?:ing)? (?:a |the )?(?:graph|diagram|figure)/i,
  /畫(?:出)?(?:圖|曲線)/,
];

/**
 * Validate a single question using the validator prompt
 */
async function validateQuestion(apiKey, question, questionType, language) {
  const prompt = QUIZ_VALIDATE_AND_FIX_PROMPT
    .replace('{questionType}', questionType)
    .replace('{language}', language === 'en' ? 'English' : 'Traditional Chinese')
    .replace('{questionJson}', JSON.stringify(question, null, 2));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a strict exam question validator. Output ONLY valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2, // Lower temperature for consistent validation
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Validation API error:', response.status);
      return { isConsistent: true, issues: [], error: 'API error' }; // Fail open
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';

    // Parse JSON
    try {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonText = codeBlockMatch ? codeBlockMatch[1] : text;
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isConsistent: parsed.isConsistent ?? true,
          issues: parsed.issues || [],
          fixedQuestion: parsed.fixedQuestion || null,
          usage: data.usage,
        };
      }
    } catch (parseErr) {
      console.error('Failed to parse validation response:', parseErr);
    }

    return { isConsistent: true, issues: [], error: 'Parse error' };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('Validation error:', err);
    return { isConsistent: true, issues: [], error: err.message }; // Fail open
  }
}

/**
 * Quick local check for forbidden phrases and visual references (before calling LLM validator)
 */
function quickForbiddenCheck(question, questionType) {
  const issues = [];
  const textToCheck = questionType === 'mc'
    ? (question.explanation || '')
    : (question.modelAnswer || '');

  // Check for forbidden meta-commentary phrases
  for (const phrase of FORBIDDEN_PHRASES) {
    if (textToCheck.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(`Contains forbidden phrase: "${phrase}"`);
    }
  }

  // Check for visual references in answer/explanation (these should be converted to data)
  for (const pattern of VISUAL_ANSWER_PATTERNS) {
    if (pattern.test(textToCheck)) {
      issues.push(`Answer references visual element: "${pattern.source}"`);
      break; // One issue is enough to trigger repair
    }
  }

  // Structure check for MC
  if (questionType === 'mc') {
    if (!question.options || question.options.length !== 4) {
      issues.push('MC must have exactly 4 options');
    }
    if (!['A', 'B', 'C', 'D'].includes(question.correctAnswer)) {
      issues.push('correctAnswer must be A, B, C, or D');
    }
  }

  // Check for short/long answer structure
  if (questionType === 'short' || questionType === 'long') {
    if (!question.modelAnswer) {
      issues.push('Short/Long question must have modelAnswer');
    }
    if (!question.markingScheme || !Array.isArray(question.markingScheme) || question.markingScheme.length === 0) {
      issues.push('Short/Long question must have markingScheme array');
    }
  }

  return issues;
}

/**
 * Validate and fix all questions, with retry logic
 */
async function validateAndProcessQuestions(apiKey, questions, questionType, language, promptTemplate, topicNames, difficulty, prototypePack) {
  const validatedQuestions = [];
  const stats = {
    totalProcessed: 0,
    passedInitial: 0,
    repairedCount: 0,
    regeneratedCount: 0,
    droppedCount: 0,
    issues: [],
  };

  for (const question of questions) {
    stats.totalProcessed++;
    let currentQuestion = { ...question };
    let repairAttempts = 0;
    let wasRepaired = false;
    let passed = false;

    // Step 1: Quick local check
    const quickIssues = quickForbiddenCheck(currentQuestion, questionType);
    if (quickIssues.length === 0) {
      // Step 2: LLM validation
      const validation = await validateQuestion(apiKey, currentQuestion, questionType, language);

      if (validation.isConsistent) {
        stats.passedInitial++;
        passed = true;
      } else {
        // Try to use the fixed version from validator
        if (validation.fixedQuestion) {
          currentQuestion = { ...validation.fixedQuestion };
          wasRepaired = true;
          repairAttempts++;
          stats.repairedCount++;

          // Re-validate the fixed version
          const revalidation = await validateQuestion(apiKey, currentQuestion, questionType, language);
          passed = revalidation.isConsistent;
        }

        if (!passed && validation.issues) {
          stats.issues.push(...validation.issues.slice(0, 2));
        }
      }
    } else {
      // Quick check failed - needs repair
      stats.issues.push(...quickIssues.slice(0, 2));
    }

    // Step 3: Additional repair attempts if still not passed
    while (!passed && repairAttempts < MAX_REPAIR_ATTEMPTS) {
      const validation = await validateQuestion(apiKey, currentQuestion, questionType, language);
      repairAttempts++;

      if (validation.isConsistent) {
        passed = true;
        wasRepaired = true;
        stats.repairedCount++;
      } else if (validation.fixedQuestion) {
        currentQuestion = { ...validation.fixedQuestion };
        wasRepaired = true;
      }
    }

    // Step 4: If still not passed, try regenerating this single question
    if (!passed) {
      let regenAttempts = 0;
      while (!passed && regenAttempts < MAX_REGEN_ATTEMPTS) {
        regenAttempts++;
        const regenResult = await generateQuestions(apiKey, promptTemplate, topicNames, difficulty, 1, language, prototypePack);

        if (regenResult.success && regenResult.questions && regenResult.questions.length > 0) {
          const newQ = regenResult.questions[0];
          const newValidation = await validateQuestion(apiKey, newQ, questionType, language);

          if (newValidation.isConsistent) {
            currentQuestion = { ...newQ };
            passed = true;
            stats.regeneratedCount++;
          } else if (newValidation.fixedQuestion) {
            currentQuestion = { ...newValidation.fixedQuestion };
            passed = true;
            stats.regeneratedCount++;
          }
        }
      }
    }

    // Step 5: Final decision
    if (passed) {
      currentQuestion._validated = true;
      currentQuestion._wasRepaired = wasRepaired;
      currentQuestion._repairAttempts = repairAttempts;
      validatedQuestions.push(currentQuestion);
    } else {
      stats.droppedCount++;
      console.warn(`Dropped question after validation failures:`, question.question?.slice(0, 100));
    }
  }

  return { questions: validatedQuestions, stats };
}

function looksLikeVisualQuestion(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return /diagram|figure|graph|as shown|shown above|shown below|curve|plot|axes|axis|下圖|如下圖|如圖|圖|曲線|坐標/.test(t);
}

function isProbablyQuestionChunk(text) {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 160) return false;
  // Avoid pure cover pages and headers
  if (/HONG KONG EXAMINATIONS AND ASSESSMENT AUTHORITY/i.test(t) && t.length < 800) return false;
  // Heuristics for question-like content
  return /\?/.test(t) || /\bWhich of the following\b/i.test(t) || /\bCalculate\b/i.test(t) || /\bExplain\b/i.test(t) || /\bA\.\s|\bB\.\s|\bC\.\s|\bD\.\s/.test(t) || /\(\s*[a-d]\s*\)/i.test(t);
}

function normalizeDocType(r) {
  const dt = (r.doc_type || r.docType || r.doc_type?.docType || '').toString();
  if (!dt) return 'Unknown';
  return dt;
}

function selectPrototypeCandidates(results, language) {
  const lang = language === 'en' ? 'en' : 'zh';

  // Prefer doc types: Past Paper + Marking Scheme. Exclude Syllabus/Candidate Performance by default.
  const excluded = new Set(['Syllabus', 'Candidate Performance']);
  const preferred = new Set(['Past Paper', 'Marking Scheme', 'Practice Paper', 'Sample Paper']);

  const enriched = (results || []).map(r => ({
    ...r,
    _docType: normalizeDocType(r),
    _lang: (r.language || r.lang || '').toString() || null,
    _text: r.content || r.text || '',
    _isQuestiony: isProbablyQuestionChunk(r.content || r.text || ''),
  }));

  const langMatched = enriched.filter(r => !r._lang || r._lang === lang);
  // If we don't have enough docs in the requested language (e.g. only English KB),
  // fall back to cross-language prototypes and let the generator output in requested language.
  const langBase = langMatched.length > 0 ? langMatched : enriched;
  const withoutExcluded = langBase.filter(r => !excluded.has(r._docType));
  const preferredOnly = withoutExcluded.filter(r => preferred.has(r._docType));

  const base = preferredOnly.length > 0 ? preferredOnly : withoutExcluded;

  // Keep Vertex relevance order, but bubble up more question-like chunks.
  const sorted = [...base].sort((a, b) => Number(b._isQuestiony) - Number(a._isQuestiony));

  // If everything looks non-questiony (cover pages etc.), still return top chunks as fallback.
  return sorted.map(r => ({ ...r, content: r._text }));
}

function pickPrototypePack(candidates) {
  const items = candidates || [];
  if (items.length === 0) return [];

  // Try to pick one Past Paper + one Marking Scheme, preferably same year if available.
  const papers = items.filter(r => normalizeDocType(r) === 'Past Paper' || normalizeDocType(r) === 'Practice Paper' || normalizeDocType(r) === 'Sample Paper');
  const schemes = items.filter(r => normalizeDocType(r) === 'Marking Scheme');

  const pickTop = (arr) => arr.length > 0 ? arr[0] : null;

  // Prefer question-like chunks when available
  const papersQ = papers.filter(p => p._isQuestiony);
  const schemesQ = schemes.filter(s => s._isQuestiony);

  let a = pickTop(papersQ) || pickTop(papers) || pickTop(items);
  let b = null;

  if (a && schemes.length > 0) {
    const pool = schemesQ.length > 0 ? schemesQ : schemes;
    b = pool.find(s => (a.year && s.year && String(a.year) === String(s.year))) || pool[0];
  }

  // If we still don't have 2 prototypes, take the next best candidate.
  const picked = [a, b].filter(Boolean);
  if (picked.length < 2) {
    const pool = items.filter(x => x !== a && x !== b);
    if (pool.length > 0) picked.push(pool[0]);
  }
  // Deduplicate by sourceUri + first 80 chars
  const seen = new Set();
  return picked.filter(p => {
    const key = `${p.sourceUri || ''}::${(p.content || '').slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatPrototypePack(prototypes, language) {
  const langLabel = language === 'en' ? 'English' : 'Traditional Chinese';
  const parts = [
    `Language: ${langLabel}`,
    `You MUST base the new questions on the prototypes below (80% similar, 20% changed).`,
    `Graph/Diagram handling: if any prototype references a graph/diagram/figure, convert it to text using a small table of data points. Do NOT require reading/drawing figures.`,
    '',
  ];

  prototypes.forEach((p, i) => {
    const dt = normalizeDocType(p);
    const year = p.year ? String(p.year) : '';
    const paper = p.paper ? String(p.paper) : '';
    const headerBits = [year, paper, dt].filter(Boolean).join(' · ');
    const header = headerBits ? `【Prototype ${i + 1}】${headerBits}` : `【Prototype ${i + 1}】`;
    const content = (p.content || '').slice(0, 1200);
    parts.push(`${header}\nSource: ${p.sourceUri || p.gcs_uri || 'unknown'}\n${content}`);
    parts.push('\n---\n');
  });

  return parts.join('\n');
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}



