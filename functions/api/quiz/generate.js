/**
 * Quiz Generation API
 * Generates MC, Short, and Long questions based on selected topics
 */

import { QUIZ_MC_PROMPT, QUIZ_SHORT_PROMPT, QUIZ_LONG_PROMPT } from '../../../shared/prompts.js';
import { PHYSICS_TOPICS, getSubtopicNames } from '../../../shared/topics.js';
import { getUserFromSession } from '../../../shared/auth.js';
import { saveTokenUsage } from '../../../shared/tokenUsage.js';

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
      language = 'zh'
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

    // Generate questions
    const allQuestions = [];
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Generate MC questions
    if (mcCount > 0) {
      const mcResult = await generateQuestions(
        apiKey,
        QUIZ_MC_PROMPT,
        topicNames,
        difficulty,
        mcCount,
        language
      );
      if (mcResult.success && mcResult.questions) {
        mcResult.questions.forEach((q, i) => {
          allQuestions.push({ ...q, type: 'mc', index: allQuestions.length });
        });
        if (mcResult.usage) {
          totalUsage.prompt_tokens += mcResult.usage.prompt_tokens || 0;
          totalUsage.completion_tokens += mcResult.usage.completion_tokens || 0;
          totalUsage.total_tokens += mcResult.usage.total_tokens || 0;
        }
      }
    }

    // Generate Short questions
    if (shortCount > 0) {
      const shortResult = await generateQuestions(
        apiKey,
        QUIZ_SHORT_PROMPT,
        topicNames,
        difficulty,
        shortCount,
        language
      );
      if (shortResult.success && shortResult.questions) {
        shortResult.questions.forEach((q, i) => {
          allQuestions.push({ ...q, type: 'short', index: allQuestions.length });
        });
        if (shortResult.usage) {
          totalUsage.prompt_tokens += shortResult.usage.prompt_tokens || 0;
          totalUsage.completion_tokens += shortResult.usage.completion_tokens || 0;
          totalUsage.total_tokens += shortResult.usage.total_tokens || 0;
        }
      }
    }

    // Generate Long questions
    if (longCount > 0) {
      const longResult = await generateQuestions(
        apiKey,
        QUIZ_LONG_PROMPT,
        topicNames,
        difficulty,
        longCount,
        language
      );
      if (longResult.success && longResult.questions) {
        longResult.questions.forEach((q, i) => {
          allQuestions.push({ ...q, type: 'long', index: allQuestions.length });
        });
        if (longResult.usage) {
          totalUsage.prompt_tokens += longResult.usage.prompt_tokens || 0;
          totalUsage.completion_tokens += longResult.usage.completion_tokens || 0;
          totalUsage.total_tokens += longResult.usage.total_tokens || 0;
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

    return new Response(JSON.stringify({
      sessionId,
      questions: questionsForClient,
      timeLimit,
      maxScore,
      totalQuestions: allQuestions.length,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in quiz/generate:', err);
    return errorResponse(500, 'Failed to generate quiz');
  }
}

async function generateQuestions(apiKey, promptTemplate, topicNames, difficulty, count, language) {
  const prompt = promptTemplate
    .replace('{topics}', topicNames.join(', '))
    .replace('{difficulty}', difficulty)
    .replace('{count}', count)
    .replace('{language}', language === 'en' ? 'English' : 'Traditional Chinese');

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


