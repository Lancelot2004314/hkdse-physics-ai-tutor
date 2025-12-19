/**
 * HKDSE Physics AI Tutor - Followup Chat API
 * Cloudflare Pages Function
 */

import { FOLLOWUP_PROMPT } from '../../shared/prompts.js';

const REQUEST_TIMEOUT = 30000; // 30 seconds

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
      return errorResponse(400, '請輸入問題');
    }

    if (!problemSummary && !previousAnswer) {
      return errorResponse(400, '缺少題目上下文');
    }

    // Build prompt
    const prompt = FOLLOWUP_PROMPT
      .replace('{problemSummary}', problemSummary || 'N/A')
      .replace('{previousAnswer}', previousAnswer || 'N/A')
      .replace('{chatHistory}', formatChatHistory(chatHistory));

    // Choose API based on needsVision
    let result;
    if (needsVision && image) {
      // Use Qwen Vision for image-related followups
      result = await callQwenVision(env.QWEN_API_KEY, image, prompt, followupQuestion);
    } else {
      // Use DeepSeek for text-only followups (cheaper)
      result = await callDeepSeek(env.DEEPSEEK_API_KEY, prompt, followupQuestion, chatHistory);
    }

    if (!result.success) {
      return errorResponse(500, result.error || 'AI 回覆失敗');
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
    return errorResponse(500, '處理失敗，請重試');
  }
}

async function callDeepSeek(apiKey, systemPrompt, userQuestion, chatHistory) {
  if (!apiKey) {
    return { success: false, error: 'API 未配置' };
  }

  const url = 'https://api.deepseek.com/chat/completions';

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
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
      return { success: false, error: 'AI 服務暫時不可用' };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      return { success: false, error: '無法解析 AI 回覆' };
    }

    return { success: true, text };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '請求超時' };
    }
    console.error('DeepSeek API call failed:', err);
    return { success: false, error: 'AI 服務連接失敗' };
  }
}

async function callQwenVision(apiKey, imageBase64, systemPrompt, userQuestion) {
  if (!apiKey) {
    return { success: false, error: 'API 未配置' };
  }

  // 通义千问 VL (Vision-Language) API
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

  const requestBody = {
    model: 'qwen-vl-plus',
    input: {
      messages: [
        {
          role: 'system',
          content: [{ text: systemPrompt }]
        },
        {
          role: 'user',
          content: [
            { image: imageBase64 },
            { text: userQuestion }
          ]
        }
      ]
    },
    parameters: {
      temperature: 0.5,
      max_tokens: 1024
    }
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
      console.error('Qwen API error:', await response.text());
      return { success: false, error: 'AI 服務暫時不可用' };
    }

    const data = await response.json();
    const text = data.output?.choices?.[0]?.message?.content?.[0]?.text;

    if (!text) {
      return { success: false, error: '無法解析 AI 回覆' };
    }

    return { success: true, text };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '請求超時' };
    }
    console.error('Qwen API call failed:', err);
    return { success: false, error: 'AI 服務連接失敗' };
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
