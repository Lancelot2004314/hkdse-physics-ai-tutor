/**
 * Quiz Generation API
 * Generates MC, Short, and Long questions based on selected topics
 * With RAG: Injects real HKDSE past paper examples for style consistency
 */

import { QUIZ_MC_PROMPT, QUIZ_SHORT_PROMPT, QUIZ_LONG_PROMPT } from '../../../shared/prompts.js';
import { PHYSICS_TOPICS, getSubtopicNames } from '../../../shared/topics.js';
import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { saveTokenUsage } from '../../../shared/tokenUsage.js';
import { searchKnowledgeBase, formatKnowledgeContext } from '../../../shared/embedding.js';
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

    // Fetch style context from knowledge base (real HKDSE examples)
    // Uses Vertex AI RAG Engine if configured, otherwise Vectorize
    let styleContext = '';
    let kbBackend = 'none';
    let styleQuery = '';
    let kbSources = [];
    let kbResultsCount = 0;

    try {
      const vertexConfig = checkVertexConfig(env);
      kbBackend = vertexConfig.configured ? 'vertex_rag' : (env.VECTORIZE ? 'vectorize' : 'none');

      if (kbBackend !== 'none') {
        // Search for relevant past paper examples based on topics
        // Use specific filters for better results
        styleQuery = `HKDSE Physics ${topicNames.slice(0, 3).join(' ')} exam question marking scheme`;

        const kbResults = await searchKnowledgeBase(styleQuery, env, {
          topK: 5,
          minScore: 0.3, // Vertex AI RAG uses distance scores
          filter: {
            subject: 'Physics',
            language: language === 'en' ? 'en' : 'zh',
            // Include both past papers and marking schemes for style reference
          },
        });

        if (kbResults && kbResults.length > 0) {
          kbResultsCount = kbResults.length;
          kbSources = kbResults
            .map(r => r.sourceUri || r.source || r.filename || r.title || '')
            .filter(Boolean)
            .slice(0, 10);
          styleContext = formatKnowledgeContext(kbResults);
          console.log(`Found ${kbResults.length} KB examples for style context (backend: ${kbBackend})`);
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

    // Build parallel generation promises
    const generationTasks = [];

    if (mcCount > 0) {
      generationTasks.push(
        generateQuestions(apiKey, QUIZ_MC_PROMPT, topicNames, difficulty, mcCount, language, styleContext)
          .then(result => ({ type: 'mc', result }))
      );
    }

    if (shortCount > 0) {
      generationTasks.push(
        generateQuestions(apiKey, QUIZ_SHORT_PROMPT, topicNames, difficulty, shortCount, language, styleContext)
          .then(result => ({ type: 'short', result }))
      );
    }

    if (longCount > 0) {
      generationTasks.push(
        generateQuestions(apiKey, QUIZ_LONG_PROMPT, topicNames, difficulty, longCount, language, styleContext)
          .then(result => ({ type: 'long', result }))
      );
    }

    // Run all generation tasks in parallel
    const results = await Promise.all(generationTasks);

    // Process results in order: MC -> Short -> Long
    const typeOrder = ['mc', 'short', 'long'];
    for (const typeKey of typeOrder) {
      const entry = results.find(r => r.type === typeKey);
      if (entry && entry.result.success && entry.result.questions) {
        entry.result.questions.forEach(q => {
          allQuestions.push({ ...q, type: typeKey, index: allQuestions.length });
        });
        if (entry.result.usage) {
          totalUsage.prompt_tokens += entry.result.usage.prompt_tokens || 0;
          totalUsage.completion_tokens += entry.result.usage.completion_tokens || 0;
          totalUsage.total_tokens += entry.result.usage.total_tokens || 0;
        }
      }
    }

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
    const questionsForClient = allQuestions.map(q => {
      const { correctAnswer, modelAnswer, markingScheme, ...clientQ } = q;
      return clientQ;
    });

    const responsePayload = {
      sessionId,
      questions: questionsForClient,
      timeLimit,
      maxScore,
      totalQuestions: allQuestions.length,
    };

    // Optional debug payload (admin only) to verify RAG usage
    if (debug === true && isAdmin(user.email, env)) {
      responsePayload.debug = {
        kbBackend,
        styleQuery: styleQuery || null,
        kbResultsCount,
        kbSources,
        styleContextExcerpt: styleContext ? styleContext.slice(0, 800) : null,
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

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}



