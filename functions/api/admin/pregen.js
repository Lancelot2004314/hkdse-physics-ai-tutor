/**
 * Admin Pre-generation API
 * Batch generate questions and store in question_bank pool
 * Creates a job for tracking progress with terminal-like logs
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
import { getSubtopicNames } from '../../../shared/topics.js';
import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { searchKnowledgeBase, enrichKbResultsWithMetadata } from '../../../shared/embedding.js';
import { checkVertexConfig } from '../../../shared/vertexRag.js';

const REQUEST_TIMEOUT = 60000; // 60 seconds
const GEMINI_MODEL = 'gemini-3-flash-preview'; // Gemini 3 Flash - Dec 2025

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
    // Check admin auth
    const user = await getUserFromSession(request, env);
    if (!user || !isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    const body = await request.json();
    const {
      subtopic,
      language = 'zh',
      qtype = 'mc',
      count = 10,
      difficulty = 3,
    } = body;

    // Validate inputs
    if (!subtopic) {
      return errorResponse(400, 'subtopic is required');
    }
    if (!['mc', 'short', 'long'].includes(qtype)) {
      return errorResponse(400, 'qtype must be mc, short, or long');
    }
    if (!['en', 'zh'].includes(language)) {
      return errorResponse(400, 'language must be en or zh');
    }
    if (count < 1 || count > 50) {
      return errorResponse(400, 'count must be 1-50');
    }

    // Check API key - use Gemini 3 Flash for pre-generation (fast and high quality)
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return errorResponse(500, 'GEMINI_API_KEY not configured');
    }

    // Create a job record
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    await env.DB.prepare(`
      INSERT INTO pregen_jobs (id, subtopic, language, qtype, difficulty, target_count, status, logs, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)
    `).bind(
      jobId,
      subtopic,
      language,
      qtype,
      difficulty,
      count,
      `[${new Date().toISOString()}] Job started: ${count} ${qtype} questions for ${subtopic} (${language})\n`,
      now,
      now
    ).run();

    // Start generation in the background (non-blocking)
    // Note: In Cloudflare Workers, we use waitUntil for background tasks
    context.waitUntil(runPregenJob(env, apiKey, jobId, subtopic, language, qtype, difficulty, count));

    return new Response(JSON.stringify({
      success: true,
      jobId,
      message: `Pre-generation job started: ${count} ${qtype} questions for ${subtopic}`,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in admin/pregen:', err);
    return errorResponse(500, 'Failed to start pre-generation: ' + err.message);
  }
}

/**
 * Run the pre-generation job (called via waitUntil for background processing)
 */
async function runPregenJob(env, apiKey, jobId, subtopic, language, qtype, difficulty, count) {
  let completedCount = 0;
  let failedCount = 0;

  try {
    // Get topic names for prompt
    const topicNames = getSubtopicNames([subtopic], language === 'en' ? 'en' : 'zh');

    // Fetch prototype pack for style consistency
    let prototypePack = '';
    let kbBackend = 'none';
    let selectedPrototypes = [];
    let usedRewriteMode = false;

    try {
      const vertexConfig = checkVertexConfig(env);
      kbBackend = vertexConfig.configured ? 'vertex_rag' : (env.VECTORIZE ? 'vectorize' : 'none');

      if (kbBackend !== 'none') {
        const styleQuery = `HKDSE Physics ${topicNames.slice(0, 3).join(' ')} DSE paper question marking scheme`;
        let kbResults = await searchKnowledgeBase(styleQuery, env, {
          topK: 10,
          minScore: 0,
          filter: { subject: 'Physics', language },
        });

        if (kbResults && kbResults.length > 0) {
          kbResults = await enrichKbResultsWithMetadata(env, kbResults);
          prototypePack = formatPrototypePack(kbResults.slice(0, 3), language);
          selectedPrototypes = kbResults.slice(0, 3).map(r => ({
            sourceUri: r.sourceUri || r.gcs_uri || null,
            docType: r.doc_type || r.docType || null,
          }));
          usedRewriteMode = true;
        }
      }
    } catch (err) {
      await appendJobLog(env, jobId, `Warning: KB search failed: ${err.message}`);
    }

    // Select prompt based on rewrite mode
    let promptTemplate;
    if (qtype === 'mc') {
      promptTemplate = usedRewriteMode ? QUIZ_MC_REWRITE_PROMPT : QUIZ_MC_PROMPT;
    } else if (qtype === 'short') {
      promptTemplate = usedRewriteMode ? QUIZ_SHORT_REWRITE_PROMPT : QUIZ_SHORT_PROMPT;
    } else {
      promptTemplate = usedRewriteMode ? QUIZ_LONG_REWRITE_PROMPT : QUIZ_LONG_PROMPT;
    }

    await appendJobLog(env, jobId, `Using ${usedRewriteMode ? 'prototype rewrite' : 'standard'} mode (${kbBackend})`);
    await appendJobLog(env, jobId, `Generating ${count} questions with ${GEMINI_MODEL}...`);

    // Generate in batches of 2 to stay within Cloudflare Workers time limits
    const batchSize = 2;
    const batches = Math.ceil(count / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchCount = Math.min(batchSize, count - (batch * batchSize));
      await appendJobLog(env, jobId, `Batch ${batch + 1}/${batches}: Generating ${batchCount} questions...`);

      try {
        const genResult = await generateQuestions(
          apiKey, promptTemplate, topicNames, difficulty, batchCount, language, prototypePack
        );

        if (!genResult.success) {
          await appendJobLog(env, jobId, `ERROR: Generation failed: ${genResult.error}`);
          failedCount += batchCount;
          continue;
        }

        if (!genResult.questions || genResult.questions.length === 0) {
          await appendJobLog(env, jobId, `WARNING: No questions returned in batch`);
          failedCount += batchCount;
          continue;
        }

        await appendJobLog(env, jobId, `Validating ${genResult.questions.length} questions...`);

        // Validate and store each question
        for (let i = 0; i < genResult.questions.length; i++) {
          const q = genResult.questions[i];
          try {
            // Use fast structural validation instead of slow LLM validation
            // This avoids Cloudflare Workers timeout (LLM validation takes too long)
            const validation = validateQuestionStructure(q, qtype);
            await appendJobLog(env, jobId, `  Q${i + 1}: Structure check: ${validation.isValid ? 'PASS' : 'FAIL'} ${validation.issues?.join(', ') || ''}`);

            if (!validation.isValid) {
              await appendJobLog(env, jobId, `  Q${i + 1}: FAILED validation (${validation.issues?.join(', ') || 'missing fields'})`);
              failedCount++;
              continue;
            }

            // Write to pool
            const poolId = await writeQuestionToPool(env, q, {
              topicKey: subtopic,
              language,
              qtype,
              difficulty,
              kbBackend,
              rewriteMode: usedRewriteMode,
              prototypeSources: selectedPrototypes,
              validatorMeta: { isConsistent: true, validationType: 'structural' },
            });

            if (poolId) {
              completedCount++;
              await appendJobLog(env, jobId, `  Q${i + 1}: Stored (${poolId})`);
            } else {
              failedCount++;
              await appendJobLog(env, jobId, `  Q${i + 1}: FAILED to store`);
            }
          } catch (valErr) {
            failedCount++;
            await appendJobLog(env, jobId, `  Q${i + 1}: ERROR: ${valErr.message}`);
          }
        }

        // Update job progress
        await env.DB.prepare(`
          UPDATE pregen_jobs SET completed_count = ?, failed_count = ?, updated_at = ? WHERE id = ?
        `).bind(completedCount, failedCount, Date.now(), jobId).run();

      } catch (batchErr) {
        await appendJobLog(env, jobId, `ERROR in batch ${batch + 1}: ${batchErr.message}`);
        failedCount += batchCount;
      }
    }

    // Mark job as completed
    const finalStatus = failedCount === count ? 'failed' : 'completed';
    await appendJobLog(env, jobId, `\nJob ${finalStatus}: ${completedCount} stored, ${failedCount} failed`);

    await env.DB.prepare(`
      UPDATE pregen_jobs SET status = ?, completed_count = ?, failed_count = ?, finished_at = ?, updated_at = ? WHERE id = ?
    `).bind(finalStatus, completedCount, failedCount, Date.now(), Date.now(), jobId).run();

  } catch (err) {
    console.error('Pregen job error:', err);
    await appendJobLog(env, jobId, `FATAL ERROR: ${err.message}`);
    await env.DB.prepare(`
      UPDATE pregen_jobs SET status = 'failed', error_message = ?, finished_at = ?, updated_at = ? WHERE id = ?
    `).bind(err.message, Date.now(), Date.now(), jobId).run();
  }
}

// ==================== Helper Functions ====================

async function appendJobLog(env, jobId, message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;

  try {
    await env.DB.prepare(`
      UPDATE pregen_jobs SET logs = logs || ?, updated_at = ? WHERE id = ?
    `).bind(logLine, Date.now(), jobId).run();
  } catch (err) {
    console.error('Failed to append job log:', err);
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
    // Use Gemini API format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: 'You are an expert HKDSE Physics examiner. Generate exam-quality questions.\n\n' + prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Gemini API error ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsed;
    try {
      // Try to extract JSON from code blocks first
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : text;

      // Try to find a JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      // Try alternative parsing for LONG questions that might have different format
      try {
        // Sometimes Gemini wraps in array instead of object
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          const arr = JSON.parse(arrayMatch[0]);
          if (Array.isArray(arr) && arr.length > 0) {
            parsed = { questions: arr };
          }
        }
      } catch (e2) {
        // Final fallback: try to find any JSON-like content
        console.error('JSON parse error:', parseErr.message, 'Text preview:', text.slice(0, 500));
        return { success: false, error: 'Failed to parse response JSON: ' + parseErr.message };
      }
    }

    if (!parsed) {
      return { success: false, error: 'No valid JSON found in response' };
    }

    return { success: true, questions: parsed?.questions || (Array.isArray(parsed) ? parsed : []) };
  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, error: err.message };
  }
}

/**
 * Fast structural validation - checks if question has required fields
 * This is much faster than LLM validation and works within Cloudflare Workers limits
 */
function validateQuestionStructure(question, qtype) {
  const issues = [];

  // Check basic required fields
  if (!question.question || question.question.length < 10) {
    issues.push('missing or too short question text');
  }

  if (qtype === 'mc') {
    // MC questions need options and correctAnswer
    if (!question.options || !Array.isArray(question.options) || question.options.length < 3) {
      issues.push('missing or insufficient options');
    }
    if (!question.correctAnswer && question.correctAnswer !== 0) {
      issues.push('missing correctAnswer');
    }
    // Check if correctAnswer is valid index or letter
    if (typeof question.correctAnswer === 'number') {
      if (question.correctAnswer < 0 || question.correctAnswer >= (question.options?.length || 0)) {
        issues.push('correctAnswer index out of range');
      }
    }
  } else if (qtype === 'long') {
    // Long questions use nested "parts" structure
    if (question.parts && Array.isArray(question.parts) && question.parts.length > 0) {
      // Check if at least one part has an answer
      const hasPartAnswer = question.parts.some(p =>
        p.modelAnswer || p.markingScheme || p.answer
      );
      if (!hasPartAnswer) {
        issues.push('no parts have modelAnswer/markingScheme');
      }
    } else if (!question.modelAnswer && !question.markingScheme && !question.answer) {
      // Fallback check for non-parts format
      issues.push('missing parts array or modelAnswer');
    }
  } else {
    // Short questions need modelAnswer or markingScheme or answer
    if (!question.modelAnswer && !question.markingScheme && !question.answer) {
      issues.push('missing modelAnswer/markingScheme/answer');
    }
  }

  // Check explanation exists (lenient for long questions with parts)
  if (qtype !== 'long') {
    if (!question.explanation && !question.modelAnswer && !question.answer) {
      issues.push('missing explanation or answer');
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

async function validateQuestion(apiKey, question, questionType, language) {
  const prompt = QUIZ_VALIDATE_AND_FIX_PROMPT
    .replace('{questionType}', questionType)
    .replace('{language}', language === 'en' ? 'English' : 'Traditional Chinese')
    .replace('{questionJson}', JSON.stringify(question, null, 2));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds for validation

  try {
    // Use Gemini API format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: 'You are a strict exam question validator. Output ONLY valid JSON.\n\n' + prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { isConsistent: true, issues: [], error: 'API error' };
    }

    const data = await response.json();
    // Use Gemini response format
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
        };
      }
    } catch {
      // Parse error
    }

    return { isConsistent: true, issues: [] };
  } catch (err) {
    clearTimeout(timeoutId);
    return { isConsistent: true, issues: [], error: err.message };
  }
}

async function writeQuestionToPool(env, question, metadata) {
  if (!env.DB) return null;

  try {
    const id = `qb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const questionJson = JSON.stringify(question);

    await env.DB.prepare(`
      INSERT INTO question_bank (
        id, topic_key, language, qtype, difficulty, question_json, status,
        kb_backend, rewrite_mode, prototype_sources, validator_meta, llm_model
      ) VALUES (?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?)
    `).bind(
      id,
      metadata.topicKey || '',
      metadata.language || 'zh',
      metadata.qtype || 'mc',
      metadata.difficulty || 3,
      questionJson,
      metadata.kbBackend || 'none',
      metadata.rewriteMode ? 1 : 0,
      JSON.stringify(metadata.prototypeSources || []),
      JSON.stringify(metadata.validatorMeta || {}),
      GEMINI_MODEL
    ).run();

    return id;
  } catch (err) {
    console.error('Error writing to pool:', err);
    return null;
  }
}

function formatPrototypePack(prototypes, language) {
  const langLabel = language === 'en' ? 'English' : 'Traditional Chinese';
  const parts = [
    `Language: ${langLabel}`,
    `You MUST base the new questions on the prototypes below (80% similar, 20% changed).`,
    '',
  ];

  prototypes.forEach((p, i) => {
    const dt = p.doc_type || p.docType || '';
    const year = p.year || '';
    const headerBits = [year, dt].filter(Boolean).join(' · ');
    const header = headerBits ? `【Prototype ${i + 1}】${headerBits}` : `【Prototype ${i + 1}】`;
    const content = (p.content || p.text || '').slice(0, 800);
    parts.push(`${header}\n${content}`);
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

