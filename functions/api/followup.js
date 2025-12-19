/**
 * HKDSE Physics AI Tutor - Followup Chat API
 * Cloudflare Pages Function
 * Uses OpenAI GPT-4o for vision followups, DeepSeek for text followups
 */

import { FOLLOWUP_PROMPT } from '../../shared/prompts.js';
import { getUserFromSession } from '../../shared/auth.js';
import { saveTokenUsage } from '../../shared/tokenUsage.js';

const REQUEST_TIMEOUT = 60000; // 60 seconds

// CORS headers
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
      followupQuestion,
      problemSummary,
      previousAnswer,
      chatHistory = [],
      needsVision = false,
      image,
    } = body;

    // Validate
    if (!followupQuestion) {
      return errorResponse(400, 'Please enter a question / 請輸入問題');
    }

    if (!problemSummary && !previousAnswer) {
      return errorResponse(400, 'Missing problem context / 缺少題目上下文');
    }

    // Get user from session (if logged in)
    const user = await getUserFromSession(request, env);

    // Build prompt with language instruction
    const prompt = FOLLOWUP_PROMPT
      .replace('{problemSummary}', problemSummary || 'N/A')
      .replace('{previousAnswer}', previousAnswer || 'N/A')
      .replace('{chatHistory}', formatChatHistory(chatHistory));

    // Choose API based on needsVision
    let result;
    let modelUsed;
    if (needsVision && image) {
      // Use OpenAI GPT-4o Vision for image-related followups
      if (!env.OPENAI_API_KEY) {
        return errorResponse(500, 'OpenAI API not configured');
      }
      result = await callOpenAIVision(env.OPENAI_API_KEY, image, prompt, followupQuestion);
      modelUsed = 'openai-gpt4o';
    } else {
      // Use DeepSeek for text-only followups (cheaper)
      if (!env.DEEPSEEK_API_KEY) {
        return errorResponse(500, 'DeepSeek API not configured');
      }
      result = await callDeepSeek(env.DEEPSEEK_API_KEY, prompt, followupQuestion, chatHistory);
      modelUsed = 'deepseek';
    }

    if (!result.success) {
      return errorResponse(500, result.error || 'AI response failed / AI 回覆失敗');
    }

    // Track token usage
    if (result.usage && env.DB) {
      await saveTokenUsage(env.DB, user?.id || null, modelUsed, result.usage, 'followup');
    }

    // Parse response
    let parsedReply;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedReply = JSON.parse(jsonMatch[0]);
      } else {
        parsedReply = { shortAnswer: result.text };
      }
    } catch {
      parsedReply = { shortAnswer: result.text };
    }

    return new Response(JSON.stringify({ reply: parsedReply }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (err) {
    console.error('Error in followup:', err);
    return errorResponse(500, 'Processing failed, please retry / 處理失敗，請重試');
  }
}

async function callDeepSeek(apiKey, systemPrompt, userQuestion, chatHistory) {
  const url = 'https://api.deepseek.com/chat/completions';

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Detect the language of the user\'s question and respond in the same language. Output valid JSON only.' },
  ];

  // Add chat history (last 6 messages max)
  chatHistory.slice(-6).forEach(msg => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  });

  // Add current question
  messages.push({ role: 'user', content: userQuestion });

  const requestBody = {
    model: 'deepseek-chat',
    messages,
    temperature: 0.5,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('DeepSeek API error:', await response.text());
      return { success: false, error: 'AI service temporarily unavailable / AI 服務暫時不可用' };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    const usage = data.usage || null;

    if (!text) {
      return { success: false, error: 'Unable to parse AI response / 無法解析 AI 回覆' };
    }

    return { success: true, text, usage };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timeout / 請求超時' };
    }
    console.error('DeepSeek API call failed:', err);
    return { success: false, error: 'AI service connection failed / AI 服務連接失敗' };
  }
}

async function callOpenAIVision(apiKey, imageBase64, systemPrompt, userQuestion) {
  const url = 'https://api.openai.com/v1/chat/completions';

  // Extract base64 data and mime type
  const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

  const requestBody = {
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: systemPrompt + '\n\nIMPORTANT: Detect the language of the user\'s question and respond in the same language. Output valid JSON only.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageBase64,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: userQuestion
          }
        ]
      }
    ],
    temperature: 0.5,
    max_tokens: 1024,
    response_format: { type: 'json_object' }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return { success: false, error: 'AI service temporarily unavailable / AI 服務暫時不可用' };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    const usage = data.usage || null;

    if (!text) {
      return { success: false, error: 'Unable to parse AI response / 無法解析 AI 回覆' };
    }

    return { success: true, text, usage };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timeout / 請求超時' };
    }
    console.error('OpenAI API call failed:', err);
    return { success: false, error: 'AI service connection failed / AI 服務連接失敗' };
  }
}

function formatChatHistory(history) {
  if (!history || history.length === 0) return 'No previous chat';
  return history
    .slice(-6)
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');
}

function errorResponse(status, message) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}
