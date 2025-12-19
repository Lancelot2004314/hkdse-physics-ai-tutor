/**
 * HKDSE Physics AI Tutor - Explain Image API
 * Cloudflare Pages Function
 */

import { TEACHER_EXPLAINER_PROMPT, SOLUTION_VERIFIER_PROMPT } from '../../shared/prompts.js';

const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB
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
    // Parse request body
    const body = await request.json();
    const { image, question, studentLevel = 'standard', mode = 'direct', studentAttempt } = body;

    // Validate image
    if (!image) {
      return errorResponse(400, '請上傳題目照片');
    }

    // Check image size (base64 encoded)
    const imageSize = (image.length * 3) / 4;
    if (imageSize > MAX_IMAGE_SIZE) {
      return errorResponse(400, '圖片太大，請壓縮至 3MB 以下');
    }

    // Extract base64 data
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    // Call Gemini Vision API
    const geminiApiKey = env.GOOGLE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error('GOOGLE_GEMINI_API_KEY not configured');
      return errorResponse(500, '服務配置錯誤，請聯繫管理員');
    }

    // Build prompt based on mode
    let systemPrompt = TEACHER_EXPLAINER_PROMPT;
    if (studentLevel === 'basic') {
      systemPrompt += '\n\nAdjust for BASIC level: Use simpler terms, more detailed steps.';
    } else if (studentLevel === 'advanced') {
      systemPrompt += '\n\nAdjust for ADVANCED level: Be concise, focus on exam strategy.';
    }

    let userPrompt = '請分析這道 HKDSE 物理題目並提供詳細講解。';
    if (question) {
      userPrompt += `\n\n學生問題：${question}`;
    }
    if (studentAttempt) {
      userPrompt += `\n\n學生答案/思路：${studentAttempt}`;
    }

    // Call Gemini Vision
    const geminiResult = await callGeminiVision(
      geminiApiKey,
      base64Data,
      mimeType,
      systemPrompt,
      userPrompt
    );

    if (!geminiResult.success) {
      return errorResponse(500, geminiResult.error || 'AI 分析失敗');
    }

    // Parse Gemini response
    let parsedResponse;
    try {
      // Try to extract JSON from response
      const jsonMatch = geminiResult.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('Failed to parse Gemini response:', parseErr);
      // Return a structured fallback
      parsedResponse = {
        problemSummary: '題目分析',
        answer: {
          steps: [geminiResult.text],
          commonMistakes: [],
          examTips: [],
          finalAnswer: '請參考上方解答',
        },
        verification: '驗算完成',
        glossary: {},
      };
    }

    // Optionally verify the solution with DeepSeek (if answer was provided)
    let verificationResult = null;
    if (parsedResponse.answer?.steps?.length > 0 && env.DEEPSEEK_API_KEY) {
      verificationResult = await verifySolution(
        env.DEEPSEEK_API_KEY,
        JSON.stringify(parsedResponse)
      );
    }

    // Combine results
    const finalResult = {
      ...parsedResponse,
      verification: verificationResult?.suggestions?.length 
        ? parsedResponse.verification + ' | ' + verificationResult.suggestions.join(', ')
        : parsedResponse.verification,
    };

    return new Response(JSON.stringify(finalResult), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (err) {
    console.error('Error in explain-image:', err);
    return errorResponse(500, '處理失敗，請重試');
  }
}

async function callGeminiVision(apiKey, base64Data, mimeType, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: systemPrompt + '\n\n' + userPrompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      return { success: false, error: 'AI 服務暫時不可用' };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return { success: false, error: '無法解析 AI 回覆' };
    }

    return { success: true, text };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '請求超時，請重試' };
    }
    console.error('Gemini API call failed:', err);
    return { success: false, error: 'AI 服務連接失敗' };
  }
}

async function verifySolution(apiKey, solutionJson) {
  const url = 'https://api.deepseek.com/chat/completions';

  const requestBody = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SOLUTION_VERIFIER_PROMPT },
      { role: 'user', content: `請驗證以下解答：\n${solutionJson}` },
    ],
    temperature: 0.1,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    
    if (text) {
      return JSON.parse(text);
    }
  } catch (err) {
    console.error('Verification failed:', err);
  }

  return null;
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
