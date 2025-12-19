/**
 * HKDSE Physics AI Tutor - Practice Question Generator
 * Generates similar practice questions based on the original question
 */

import { PRACTICE_QUESTION_PROMPT } from '../../../shared/prompts.js';
import { getUserFromSession } from '../../../shared/auth.js';
import { saveTokenUsage } from '../../../shared/tokenUsage.js';

const REQUEST_TIMEOUT = 60000;

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
    const { originalQuestion, topic, originalAnswer } = body;

    console.log('Practice generate request:', { originalQuestion: originalQuestion?.substring(0, 50), topic });

    // Use a default question if none provided
    const questionToUse = originalQuestion?.trim() || 'A physics problem about mechanics';

    // Check API key
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('DEEPSEEK_API_KEY not configured');
      return errorResponse(500, 'Service not configured');
    }

    // Get user from session (optional - practice works without login)
    let user = null;
    try {
      user = await getUserFromSession(request, env);
    } catch (authErr) {
      console.warn('Auth check failed:', authErr);
    }

    // Build prompt
    const userPrompt = `Original Question: ${questionToUse}
${originalAnswer ? `Original Answer: ${originalAnswer}` : ''}
${topic ? `Topic: ${topic}` : ''}

Generate a similar HKDSE Physics practice question with different numerical values. Make it a multiple choice question.`;

    // Call DeepSeek
    console.log('Calling DeepSeek for practice question...');
    const result = await callDeepSeek(apiKey, PRACTICE_QUESTION_PROMPT, userPrompt);

    if (!result.success) {
      console.error('DeepSeek call failed:', result.error);
      return errorResponse(500, result.error || 'Failed to generate question');
    }

    console.log('DeepSeek response received, length:', result.text?.length);

    // Track token usage (non-blocking)
    if (result.usage && env.DB) {
      saveTokenUsage(env.DB, user?.id || null, 'deepseek', result.usage, 'practice-generate')
        .catch(err => console.warn('Token tracking failed:', err));
    }

    // Parse response
    let parsedResponse;
    try {
      let textToParse = result.text;

      // Strip markdown code blocks
      const codeBlockMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        textToParse = codeBlockMatch[1];
      }

      const jsonMatch = textToParse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        console.error('No JSON found in response:', textToParse.substring(0, 200));
        throw new Error('No JSON found');
      }

      // Validate required fields
      if (!parsedResponse.question || !parsedResponse.options || !parsedResponse.correctAnswer) {
        console.error('Missing required fields:', Object.keys(parsedResponse));
        throw new Error('Missing required fields');
      }
    } catch (parseErr) {
      console.error('Failed to parse practice question:', parseErr, result.text?.substring(0, 300));
      return errorResponse(500, 'Failed to parse generated question');
    }

    // Generate unique ID for this practice question
    const practiceId = crypto.randomUUID();

    // Store in database for later verification (only if user is logged in)
    if (env.DB && user?.id) {
      try {
        await env.DB.prepare(`
          INSERT INTO practice_history (id, user_id, original_question, generated_question, options, correct_answer, topic)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          practiceId,
          user.id,
          questionToUse,
          parsedResponse.question,
          JSON.stringify(parsedResponse.options || []),
          parsedResponse.correctAnswer,
          topic || parsedResponse.topic || null
        ).run();
        console.log('Practice question saved to DB:', practiceId);
      } catch (dbErr) {
        console.error('Failed to save practice question:', dbErr);
        // Don't fail the request, just log the error
      }
    }

    return new Response(JSON.stringify({
      id: practiceId,
      question: parsedResponse.question,
      options: parsedResponse.options,
      correctAnswer: user?.id ? undefined : parsedResponse.correctAnswer, // Only hide if logged in (for DB verification)
      topic: topic || parsedResponse.topic,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in practice/generate:', err);
    return errorResponse(500, 'Failed to generate practice question');
  }
}

async function callDeepSeek(apiKey, systemPrompt, userPrompt) {
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7, // Higher for variety
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek error:', response.status, errorText);
      return { success: false, error: `API error (${response.status})` };
    }

    const data = await response.json();
    return {
      success: true,
      text: data.choices[0]?.message?.content || '',
      usage: data.usage,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    return { success: false, error: err.message };
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
