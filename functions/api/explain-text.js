/**
 * HKDSE Physics AI Tutor - Explain Text API
 * Cloudflare Pages Function
 * For text-only physics questions (no image required)
 */

import { TEACHER_EXPLAINER_PROMPT, SOCRATIC_TUTOR_PROMPT } from '../../shared/prompts.js';
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
    // Parse request body
    const body = await request.json();
    const { problemText, question, studentLevel = 'standard', mode = 'direct', studentAttempt } = body;

    // Validate problemText
    if (!problemText || problemText.trim().length === 0) {
      return errorResponse(400, 'Please enter the problem content / 請輸入題目內容');
    }

    // Check DeepSeek API key
    const deepseekApiKey = env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      console.error('DEEPSEEK_API_KEY not configured');
      return errorResponse(500, '服務配置錯誤，請聯繫管理員');
    }

    // Build prompt based on mode
    let systemPrompt = mode === 'socratic' ? SOCRATIC_TUTOR_PROMPT : TEACHER_EXPLAINER_PROMPT;

    // Adjust for student level
    if (studentLevel === 'basic') {
      systemPrompt += '\n\nAdjust for BASIC level: Use simpler terms, more detailed steps, explain every concept thoroughly.';
    } else if (studentLevel === 'advanced') {
      systemPrompt += '\n\nAdjust for ADVANCED level: Be concise, focus on exam strategy and common pitfalls.';
    }

    // Build user prompt - language neutral to allow detection
    let userPrompt = `Analyze the following HKDSE Physics problem and provide a detailed explanation. Detect the language of the problem and respond in the same language.\n\nProblem:\n${problemText.trim()}`;

    if (question) {
      userPrompt += `\n\nStudent's question: ${question}`;
    }
    if (studentAttempt) {
      userPrompt += `\n\nStudent's attempt/thoughts: ${studentAttempt}`;
    }

    // Get user from session (if logged in)
    const user = await getUserFromSession(request, env);

    // Call DeepSeek API
    const result = await callDeepSeek(deepseekApiKey, systemPrompt, userPrompt);

    if (!result.success) {
      return errorResponse(500, result.error || 'AI analysis failed / AI 分析失敗');
    }

    // Track DeepSeek token usage
    if (result.usage && env.DB) {
      await saveTokenUsage(env.DB, user?.id || null, 'deepseek', result.usage, 'explain-text');
    }

    // Parse DeepSeek response - handle markdown code blocks
    let parsedResponse;
    try {
      let textToParse = result.text;

      // Strip markdown code blocks if present
      const codeBlockMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        textToParse = codeBlockMatch[1];
      }

      // Extract JSON object
      const jsonMatch = textToParse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('Failed to parse DeepSeek response:', parseErr);
      // Fallback: split raw response into readable paragraphs
      const rawText = result.text
        .replace(/```json\s*/g, '')
        .replace(/```/g, '')
        .trim();

      const paragraphs = rawText.split(/\n\n+/).filter(p => p.trim());

      parsedResponse = {
        problemSummary: 'Analysis Result',
        answer: {
          steps: paragraphs.length > 0 ? paragraphs : [rawText],
          commonMistakes: [],
          examTips: [],
          finalAnswer: 'See explanation above',
        },
        verification: 'Complete',
        glossary: {},
      };
    }

    // Handle Socratic mode - map to unified structure if needed
    if (mode === 'socratic') {
      if (parsedResponse.guidingQuestions) {
        // Convert Socratic output to standard format
        const steps = parsedResponse.guidingQuestions.map((q, i) => {
          let stepContent = `${q.question}`;
          if (q.hint1) stepContent += `\n💡 ${q.hint1}`;
          if (q.hint2) stepContent += `\n💡 ${q.hint2}`;
          if (q.hint3) stepContent += `\n💡 ${q.hint3}`;
          return stepContent;
        });

        parsedResponse = {
          problemSummary: 'Socratic Mode - Think through guided questions',
          answer: {
            steps: steps,
            commonMistakes: [],
            examTips: parsedResponse.nextStep ? [parsedResponse.nextStep] : [],
            finalAnswer: 'Think about the questions above first',
          },
          verification: 'Guided mode',
          glossary: parsedResponse.glossary || {},
          _socratic: true,
        };
      } else {
        // Even if format is different, mark as socratic
        parsedResponse._socratic = true;
      }
    }

    return new Response(JSON.stringify(parsedResponse), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (err) {
    console.error('Error in explain-text:', err);
    return errorResponse(500, 'Processing failed, please retry / 處理失敗，請重試');
  }
}

async function callDeepSeek(apiKey, systemPrompt, userPrompt) {
  const url = 'https://api.deepseek.com/chat/completions';

  const requestBody = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: systemPrompt + '\n\nIMPORTANT: You MUST respond with valid JSON only, no markdown code blocks or extra text.'
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,  // Low temperature for consistent responses
    max_tokens: 4096,
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
      const errorText = await response.text().catch(() => '');
      console.error('DeepSeek API error:', response.status, errorText);
      return { success: false, error: `AI service error (${response.status}) / AI 服務錯誤` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    const usage = data.usage || null;

    if (!text) {
      console.error('DeepSeek response:', JSON.stringify(data));
      return { success: false, error: 'Unable to parse AI response / 無法解析 AI 回覆' };
    }

    return { success: true, text, usage };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timeout, please retry / 請求超時，請重試' };
    }
    console.error('DeepSeek API call failed:', err);
    return { success: false, error: 'AI service connection failed / AI 服務連接失敗' };
  }
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
