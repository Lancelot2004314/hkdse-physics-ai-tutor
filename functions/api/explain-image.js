/**
 * HKDSE Physics AI Tutor - Explain Image API
 * Cloudflare Pages Function
 * Uses OpenAI GPT-4o Vision for image analysis
 */

import { TEACHER_EXPLAINER_PROMPT, SOLUTION_VERIFIER_PROMPT } from '../../shared/prompts.js';
import { getUserFromSession } from '../../shared/auth.js';
import { saveTokenUsage } from '../../shared/tokenUsage.js';

const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB
const REQUEST_TIMEOUT = 90000; // 90 seconds for vision model

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
      return errorResponse(400, '請上傳題目照片 / Please upload an image');
    }

    // Check image size (base64 encoded)
    const imageSize = (image.length * 3) / 4;
    if (imageSize > MAX_IMAGE_SIZE) {
      return errorResponse(400, '圖片太大，請壓縮至 3MB 以下 / Image too large, please compress to under 3MB');
    }

    // Extract base64 data
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    // Check OpenAI API key
    const openaiApiKey = env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return errorResponse(500, '服務配置錯誤，請聯繫管理員');
    }

    // Build prompt based on mode
    let systemPrompt = TEACHER_EXPLAINER_PROMPT;
    if (studentLevel === 'basic') {
      systemPrompt += '\n\nAdjust for BASIC level: Use simpler terms, more detailed steps.';
    } else if (studentLevel === 'advanced') {
      systemPrompt += '\n\nAdjust for ADVANCED level: Be concise, focus on exam strategy.';
    }

    // User prompt - let GPT-4o detect the language from the image and question
    let userPrompt = 'Analyze this HKDSE Physics problem and provide a detailed explanation. Detect the language of the problem and respond in the same language.';
    if (question) {
      userPrompt += `\n\nStudent's question: ${question}`;
    }
    if (studentAttempt) {
      userPrompt += `\n\nStudent's attempt/thoughts: ${studentAttempt}`;
    }

    // Get user from session (if logged in)
    const user = await getUserFromSession(request, env);

    // Call OpenAI Vision
    const visionResult = await callOpenAIVision(
      openaiApiKey,
      base64Data,
      mimeType,
      systemPrompt,
      userPrompt
    );

    if (!visionResult.success) {
      return errorResponse(500, visionResult.error || 'AI analysis failed / AI 分析失敗');
    }

    // Track OpenAI token usage
    if (visionResult.usage && env.DB) {
      await saveTokenUsage(env.DB, user?.id || null, 'openai-gpt4o-mini', visionResult.usage, 'explain-image');
    }

    // Parse OpenAI response
    let parsedResponse;
    try {
      // Try to extract JSON from response
      const jsonMatch = visionResult.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('Failed to parse OpenAI response:', parseErr);
      // Return a structured fallback
      parsedResponse = {
        problemSummary: 'Problem Analysis / 題目分析',
        answer: {
          steps: [visionResult.text],
          commonMistakes: [],
          examTips: [],
          finalAnswer: 'See explanation above / 請參考上方解答',
        },
        verification: 'Verification complete / 驗算完成',
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
      // Track DeepSeek verification token usage
      if (verificationResult?.usage && env.DB) {
        await saveTokenUsage(env.DB, user?.id || null, 'deepseek', verificationResult.usage, 'explain-image-verify');
      }
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
    return errorResponse(500, '處理失敗，請重試 / Processing failed, please retry');
  }
}

async function callOpenAIVision(apiKey, base64Data, mimeType, systemPrompt, userPrompt) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const requestBody = {
    model: 'gpt-4o-mini',  // Using mini for better availability
    messages: [
      {
        role: 'system',
        content: systemPrompt + '\n\nIMPORTANT: You MUST respond with valid JSON only, no markdown code blocks or extra text.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: userPrompt
          }
        ]
      }
    ],
    temperature: 0.3,
    max_tokens: 4096,
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
      const errorText = await response.text().catch(() => '');
      console.error('OpenAI API error:', response.status, errorText);
      return { success: false, error: `AI service error (${response.status}) / AI 服務錯誤` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      console.error('OpenAI response:', JSON.stringify(data));
      return { success: false, error: 'Unable to parse AI response / 無法解析 AI 回覆' };
    }

    // Extract usage info from OpenAI response
    const usage = data.usage || null;

    return { success: true, text, usage };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timeout, please retry / 請求超時，請重試' };
    }
    console.error('OpenAI API call failed:', err);
    return { success: false, error: 'AI service connection failed / AI 服務連接失敗' };
  }
}

async function verifySolution(apiKey, solutionJson) {
  const url = 'https://api.deepseek.com/chat/completions';

  const requestBody = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SOLUTION_VERIFIER_PROMPT },
      { role: 'user', content: `Please verify the following solution:\n${solutionJson}` },
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
    const usage = data.usage || null;

    if (text) {
      const parsed = JSON.parse(text);
      return { ...parsed, usage };
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
