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

    if (!originalQuestion || originalQuestion.trim().length === 0) {
      return errorResponse(400, 'Original question is required');
    }

    // Check API key
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return errorResponse(500, 'Service not configured');
    }

    // Get user from session
    const user = await getUserFromSession(request, env);

    // Build prompt
    const userPrompt = `Original Question: ${originalQuestion}
${originalAnswer ? `Original Answer: ${originalAnswer}` : ''}
${topic ? `Topic: ${topic}` : ''}

Generate a similar practice question with different numerical values.`;

    // Call DeepSeek
    const result = await callDeepSeek(apiKey, PRACTICE_QUESTION_PROMPT, userPrompt);

    if (!result.success) {
      return errorResponse(500, result.error || 'Failed to generate question');
    }

    // Track token usage
    if (result.usage && env.DB) {
      await saveTokenUsage(env.DB, user?.id || null, 'deepseek', result.usage, 'practice-generate');
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
        throw new Error('No JSON found');
      }
    } catch (parseErr) {
      console.error('Failed to parse practice question:', parseErr);
      return errorResponse(500, 'Failed to parse generated question');
    }

    // Generate unique ID for this practice question
    const practiceId = crypto.randomUUID();

    // Store in database for later verification
    if (env.DB && user?.id) {
      try {
        await env.DB.prepare(`
          INSERT INTO practice_history (id, user_id, original_question, generated_question, options, correct_answer, topic)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          practiceId,
          user.id,
          originalQuestion,
          parsedResponse.question,
          JSON.stringify(parsedResponse.options || []),
          parsedResponse.correctAnswer,
          topic || null
        ).run();
      } catch (dbErr) {
        console.error('Failed to save practice question:', dbErr);
      }
    }

    return new Response(JSON.stringify({
      id: practiceId,
      question: parsedResponse.question,
      options: parsedResponse.options,
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
