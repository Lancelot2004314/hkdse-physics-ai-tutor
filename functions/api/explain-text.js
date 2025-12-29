/**
 * HKDSE Physics AI Tutor - Explain Text API
 * Cloudflare Pages Function
 * Uses Gemini 3 Flash for text-only physics questions (globally available, no VPN required)
 * Stores text questions + answers in D1 database for admin review
 */

import { TEACHER_EXPLAINER_PROMPT, SOCRATIC_TUTOR_PROMPT } from '../../shared/prompts.js';
import { getUserFromSession } from '../../shared/auth.js';
import { saveTokenUsage } from '../../shared/tokenUsage.js';
import { searchKnowledgeBase, formatKnowledgeContext } from '../../shared/embedding.js';

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
    const { problemText, question, studentLevel = 'standard', mode = 'direct', studentAttempt, language = 'auto' } = body;

    // Validate problemText
    if (!problemText || problemText.trim().length === 0) {
      return errorResponse(400, 'Please enter the problem content / 請輸入題目內容');
    }

    // Build prompt based on mode
    let systemPrompt = mode === 'socratic' ? SOCRATIC_TUTOR_PROMPT : TEACHER_EXPLAINER_PROMPT;

    // Adjust for student level
    if (studentLevel === 'basic') {
      systemPrompt += '\n\nAdjust for BASIC level: Use simpler terms, more detailed steps, explain every concept thoroughly.';
    } else if (studentLevel === 'advanced') {
      systemPrompt += '\n\nAdjust for ADVANCED level: Be concise, focus on exam strategy and common pitfalls.';
    }

    // RAG: Search knowledge base for relevant DSE content
    let knowledgeContext = '';
    if (env.VECTORIZE && env.OPENAI_API_KEY) {
      try {
        const ragResults = await searchKnowledgeBase(problemText, env, {
          topK: 3,
          minScore: 0.75,
        });
        if (ragResults.length > 0) {
          knowledgeContext = formatKnowledgeContext(ragResults);
          systemPrompt += `\n\n## 相关 DSE 历届试题参考 (Related DSE Past Paper Reference):\n${knowledgeContext}\n\n请参考以上历届试题的风格和评分标准来回答学生的问题。`;
        }
      } catch (err) {
        console.warn('RAG search failed, continuing without context:', err.message);
      }
    }

    // Build user prompt - use specified language or detect from content
    let languageInstruction;
    if (language === 'auto') {
      languageInstruction = 'Detect the language of the problem and respond in the same language.';
    } else if (language === 'en') {
      languageInstruction = 'Respond ONLY in English.';
    } else if (language === 'zh-HK') {
      languageInstruction = '請使用繁體中文回答。';
    } else if (language === 'zh-CN') {
      languageInstruction = '请使用简体中文回答。';
    } else {
      languageInstruction = 'Respond in the same language as the problem.';
    }

    let userPrompt = `Analyze the following HKDSE Physics problem and provide a detailed explanation. ${languageInstruction}\n\nProblem:\n${problemText.trim()}`;

    if (question) {
      userPrompt += `\n\nStudent's question: ${question}`;
    }
    if (studentAttempt) {
      userPrompt += `\n\nStudent's attempt/thoughts: ${studentAttempt}`;
    }

    // Get user from session (if logged in)
    const user = await getUserFromSession(request, env);

    // Try Gemini Flash first (globally available, no VPN needed), fallback to DeepSeek
    let result;
    let usedModel = 'gemini-flash';

    if (env.GEMINI_API_KEY) {
      result = await callGeminiFlash(env.GEMINI_API_KEY, systemPrompt, userPrompt);
    }

    // Fallback to DeepSeek if Gemini fails or not configured
    if (!result?.success && env.DEEPSEEK_API_KEY) {
      console.log('Gemini Flash failed or not configured, falling back to DeepSeek');
      result = await callDeepSeek(env.DEEPSEEK_API_KEY, systemPrompt, userPrompt);
      usedModel = 'deepseek';
    }

    if (!result?.success) {
      return errorResponse(500, result?.error || 'AI analysis failed / AI 分析失敗');
    }

    // Track token usage
    if (result.usage && env.DB) {
      await saveTokenUsage(env.DB, user?.id || null, usedModel, result.usage, 'explain-text');
    }

    // Parse response - handle markdown code blocks
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
      console.error('Failed to parse response:', parseErr);
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

    // Add model info
    parsedResponse._model = usedModel;

    // Save text question + answer to D1 database (for admin review)
    if (env.DB) {
      try {
        await saveTextQuestion(env.DB, problemText.trim(), JSON.stringify(parsedResponse));
      } catch (dbErr) {
        console.error('Failed to save text question to DB:', dbErr);
        // Don't fail the request, just log the error
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

/**
 * Save text question + AI answer to D1 database
 */
async function saveTextQuestion(db, questionText, aiAnswer) {
  const id = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO text_questions (id, question_text, ai_answer, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).bind(id, questionText, aiAnswer).run();

  console.log(`Saved text question to DB: ${id}`);
  return id;
}

/**
 * Google Gemini 3 Flash - Primary model (fast, globally available, no VPN needed)
 * Released December 2025 - faster than 2.5 Flash with PhD-level reasoning
 */
async function callGeminiFlash(apiKey, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: systemPrompt + '\n\n' + userPrompt + '\n\nIMPORTANT: You MUST respond with valid JSON only, no markdown code blocks or extra text.'
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json'
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Gemini Flash error:', response.status, errorText);
      return { success: false, error: `Gemini Flash error (${response.status})` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    const usage = {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    };

    if (!text) {
      return { success: false, error: 'Empty response from Gemini Flash' };
    }

    return { success: true, text, usage };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    console.error('Gemini Flash call failed:', err);
    return { success: false, error: 'Gemini Flash connection failed' };
  }
}

/**
 * DeepSeek - Fallback model
 */
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
    temperature: 0.1,
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
