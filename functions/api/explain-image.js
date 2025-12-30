/**
 * HKDSE Physics AI Tutor - Explain Image API
 * Cloudflare Pages Function
 * Supports multiple vision models with auto-fallback
 */

import { TEACHER_EXPLAINER_PROMPT, SOLUTION_VERIFIER_PROMPT } from '../../shared/prompts.js';
import { getUserFromSession } from '../../shared/auth.js';
import { saveTokenUsage } from '../../shared/tokenUsage.js';
import { searchKnowledgeBase, formatKnowledgeContext } from '../../shared/embedding.js';

const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB
const REQUEST_TIMEOUT = 120000; // 120 seconds for vision model (qwen-vl-max needs more time)
const OCR_TIMEOUT = 15000; // 15 seconds for OCR pre-processing (quick extraction)

// Use Qwen3-VL-Flash (with thinking mode for accurate reasoning)
const MODEL_PRIORITY = ['qwen-vl'];

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
    const {
      image,
      question,
      studentLevel = 'standard',
      mode = 'direct',
      studentAttempt,
      visionModel = 'auto',  // 'auto', 'gpt4o', 'gpt4o-mini', 'qwen-vl', 'gemini'
      language = 'auto'      // 'auto', 'en', 'zh-HK', 'zh-CN'
    } = body;

    // Validate image
    if (!image) {
      return errorResponse(400, 'Please upload an image / 請上傳題目照片');
    }

    // Check image size (base64 encoded)
    const imageSize = (image.length * 3) / 4;
    if (imageSize > MAX_IMAGE_SIZE) {
      return errorResponse(400, 'Image too large, please compress to under 3MB / 圖片太大，請壓縮至 3MB 以下');
    }

    // Extract base64 data
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    // Build prompt based on mode
    let systemPrompt = TEACHER_EXPLAINER_PROMPT;
    if (studentLevel === 'basic') {
      systemPrompt += '\n\nAdjust for BASIC level: Use simpler terms, more detailed steps.';
    } else if (studentLevel === 'advanced') {
      systemPrompt += '\n\nAdjust for ADVANCED level: Be concise, focus on exam strategy.';
    }

    // RAG: Search knowledge base for relevant DSE content
    // Use the student's question or attempt as search query
    const searchQuery = question || studentAttempt || 'HKDSE Physics problem';
    if (env.VECTORIZE && env.OPENAI_API_KEY && searchQuery.length > 10) {
      try {
        const ragResults = await searchKnowledgeBase(searchQuery, env, {
          topK: 3,
          minScore: 0.7,
        });
        if (ragResults.length > 0) {
          const knowledgeContext = formatKnowledgeContext(ragResults);
          systemPrompt += `\n\n## 相关 DSE 历届试题参考 (Related DSE Past Paper Reference):\n${knowledgeContext}\n\n请参考以上历届试题的风格和评分标准来回答学生的问题。`;
        }
      } catch (err) {
        console.warn('RAG search failed, continuing without context:', err.message);
      }
    }

    // User prompt - use specified language or let model detect
    let userPrompt;
    if (language === 'auto') {
      userPrompt = 'Analyze this HKDSE Physics problem and provide a detailed explanation. Detect the language of the problem and respond in the same language.';
    } else if (language === 'en') {
      userPrompt = 'Analyze this HKDSE Physics problem and provide a detailed explanation. Respond ONLY in English.';
    } else if (language === 'zh-HK') {
      userPrompt = '分析這道 HKDSE 物理題目，並提供詳細解釋。請使用繁體中文回答。';
    } else if (language === 'zh-CN') {
      userPrompt = '分析这道 HKDSE 物理题目，并提供详细解释。请使用简体中文回答。';
    } else {
      userPrompt = 'Analyze this HKDSE Physics problem and provide a detailed explanation.';
    }
    if (question) {
      userPrompt += `\n\nStudent's question: ${question}`;
    }
    if (studentAttempt) {
      userPrompt += `\n\nStudent's attempt/thoughts: ${studentAttempt}`;
    }

    // Get user from session (if logged in)
    const user = await getUserFromSession(request, env);

    // OCR Pre-processing: Disabled for faster response
    // TODO: Re-enable when needed for blurry images
    // let ocrText = null;
    // if (env.QWEN_API_KEY) {
    //   try {
    //     ocrText = await extractTextWithOCR(env.QWEN_API_KEY, base64Data, mimeType);
    //     if (ocrText && ocrText.length > 10) {
    //       userPrompt += `\n\n[OCR 参考文字]:\n${ocrText}`;
    //     }
    //   } catch (ocrErr) {
    //     console.warn('OCR failed:', ocrErr.message);
    //   }
    // }

    // Determine which models to try
    let modelsToTry;
    if (visionModel === 'auto') {
      // Try all models in priority order
      modelsToTry = MODEL_PRIORITY.filter(m => hasApiKey(env, m));
    } else {
      // Try specific model first, then fallback to others if auto-fallback
      modelsToTry = [visionModel, ...MODEL_PRIORITY.filter(m => m !== visionModel && hasApiKey(env, m))];
    }

    // Debug: Log Qwen API key status
    console.log('QWEN_API_KEY configured:', !!env.QWEN_API_KEY);

    if (modelsToTry.length === 0) {
      return errorResponse(500, 'No vision API configured / 未配置視覺 API');
    }

    // Try each model until one succeeds
    let visionResult = null;
    let usedModel = null;
    let lastError = null;
    const modelErrors = []; // Track all errors for debugging

    for (const modelName of modelsToTry) {
      console.log(`Trying vision model: ${modelName}`);

      const result = await callVisionModel(
        env,
        modelName,
        base64Data,
        mimeType,
        image,
        systemPrompt,
        userPrompt
      );

      if (result.success) {
        visionResult = result;
        usedModel = modelName;
        console.log(`Model ${modelName} succeeded!`);
        break;
      } else {
        lastError = result.error;
        modelErrors.push({ model: modelName, error: result.error });
        console.error(`Model ${modelName} failed: ${result.error}`);
        // Continue to next model
      }
    }

    if (!visionResult) {
      console.error('All models failed:', modelErrors);
      return errorResponse(500, lastError || 'All vision models failed / 所有視覺模型都失敗');
    }

    // Track token usage
    if (visionResult.usage && env.DB) {
      await saveTokenUsage(env.DB, user?.id || null, usedModel, visionResult.usage, 'explain-image');
    }

    // Parse response - handle markdown code blocks
    let parsedResponse;
    try {
      let textToParse = visionResult.text;

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
      console.error('Failed to parse vision response:', parseErr);
      // Fallback: split raw response into readable paragraphs
      const rawText = visionResult.text
        .replace(/```json\s*/g, '')
        .replace(/```/g, '')
        .trim();

      // Try to extract meaningful content
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

    // Final result - no messy verification append
    const finalResult = {
      ...parsedResponse,
      _model: usedModel, // Include which model was used (for debugging)
    };

    // Save to D1 if image is text-only (no figures/graphs)
    // We do a quick check using Qwen-VL to detect if there are diagrams (globally available)
    if (env.DB && env.QWEN_API_KEY) {
      try {
        const textExtraction = await extractTextIfNoFigures(env.QWEN_API_KEY, base64Data, mimeType);
        if (textExtraction.isTextOnly && textExtraction.extractedText) {
          await saveTextQuestion(env.DB, textExtraction.extractedText, JSON.stringify(finalResult));
          console.log('Saved text-only image question to DB');
        } else {
          console.log('Image contains figures/graphs, not saving to text DB');
        }
      } catch (dbErr) {
        console.error('Failed to check/save image question:', dbErr);
        // Don't fail the request, just log
      }
    }

    return new Response(JSON.stringify(finalResult), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (err) {
    console.error('Error in explain-image:', err);
    return errorResponse(500, 'Processing failed, please retry / 處理失敗，請重試');
  }
}

/**
 * Check if image contains figures/graphs/diagrams, and extract text if it's text-only
 * Uses Qwen-VL (globally available, no VPN needed)
 */
async function extractTextIfNoFigures(apiKey, base64Data, mimeType) {
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

  const promptText = `Analyze this image and respond with JSON only:
{
  "hasFigures": true/false,
  "extractedText": "..."
}

hasFigures should be true if image contains: graphs, charts, diagrams, circuit diagrams, force diagrams, illustrations, drawings, plots, tables with visual elements.
hasFigures should be false if image only contains pure text (printed or handwritten) with no visual diagrams.
If hasFigures is false, extract ALL the text from the image into extractedText. If hasFigures is true, leave extractedText empty.`;

  const requestBody = {
    model: 'qwen-vl-max',  // Strongest vision model
    input: {
      messages: [
        {
          role: 'user',
          content: [
            { image: `data:${mimeType};base64,${base64Data}` },
            { text: promptText }
          ]
        }
      ]
    },
    parameters: {
      temperature: 0.1,
      max_tokens: 2048
    }
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
      console.error('Figure detection failed:', response.status);
      return { isTextOnly: false, extractedText: null };
    }

    const data = await response.json();
    const text = data.output?.choices?.[0]?.message?.content?.[0]?.text;

    if (!text) {
      return { isTextOnly: false, extractedText: null };
    }

    // Parse JSON response
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error('Failed to parse figure detection response:', e);
      return { isTextOnly: false, extractedText: null };
    }

    if (!parsed) {
      return { isTextOnly: false, extractedText: null };
    }

    return {
      isTextOnly: parsed.hasFigures === false,
      extractedText: parsed.hasFigures === false ? (parsed.extractedText || '').trim() : null
    };

  } catch (err) {
    console.error('Figure detection error:', err);
    return { isTextOnly: false, extractedText: null };
  }
}

/**
 * Extract text from image using OCR (optimized for blurry images)
 * Uses Qwen-VL with a specialized OCR prompt
 */
async function extractTextWithOCR(apiKey, base64Data, mimeType) {
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

  // Specialized OCR prompt - focuses on text extraction only
  const ocrPrompt = `你是一个专业的 OCR 文字识别系统。请仔细识别这张图片中的所有文字内容。

要求：
1. 提取图片中的所有可见文字（包括模糊的文字）
2. 保持原有的格式和换行
3. 如果是数学公式，用 LaTeX 格式表示
4. 如果某些文字模糊难以辨认，请尽力推测最可能的内容
5. 只输出识别到的文字，不要添加任何解释或分析

直接输出识别到的文字内容：`;

  const requestBody = {
    model: 'qwen-vl-max',  // Strongest vision model
    input: {
      messages: [
        {
          role: 'user',
          content: [
            { image: `data:${mimeType};base64,${base64Data}` },
            { text: ocrPrompt }
          ]
        }
      ]
    },
    parameters: {
      temperature: 0.1,  // Very low temperature for accurate recognition
      max_tokens: 2048
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT);

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
      console.error('OCR API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.output?.choices?.[0]?.message?.content?.[0]?.text;

    if (!text || text.length < 5) {
      return null;
    }

    // Clean up the extracted text
    return text.trim();

  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('OCR request timeout');
    } else {
      console.error('OCR extraction error:', err);
    }
    return null;
  }
}

/**
 * Save text question + AI answer to D1 database
 */
async function saveTextQuestion(db, questionText, aiAnswer) {
  if (!questionText || questionText.length < 10) {
    console.log('Question text too short, not saving');
    return null;
  }

  const id = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO text_questions (id, question_text, ai_answer, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).bind(id, questionText, aiAnswer).run();

  console.log(`Saved text question to DB: ${id}`);
  return id;
}

// Check if API key exists for a model
function hasApiKey(env, modelName) {
  switch (modelName) {
    case 'gpt4o':
    case 'gpt4o-mini':
      return !!env.OPENAI_API_KEY;
    case 'qwen-vl':
      return !!env.QWEN_API_KEY;
    case 'gemini':
    case 'gemini-flash':
      return !!env.GEMINI_API_KEY;
    default:
      return false;
  }
}

// Call the appropriate vision model
async function callVisionModel(env, modelName, base64Data, mimeType, fullImage, systemPrompt, userPrompt) {
  switch (modelName) {
    case 'gemini-flash':
      return await callGeminiFlash(env.GEMINI_API_KEY, base64Data, mimeType, systemPrompt, userPrompt);
    case 'gpt4o':
      return await callOpenAI(env.OPENAI_API_KEY, 'gpt-4o', base64Data, mimeType, systemPrompt, userPrompt);
    case 'gpt4o-mini':
      return await callOpenAI(env.OPENAI_API_KEY, 'gpt-4o-mini', base64Data, mimeType, systemPrompt, userPrompt);
    case 'qwen-vl':
      return await callQwenVision(env.QWEN_API_KEY, base64Data, mimeType, systemPrompt, userPrompt);
    case 'gemini':
      return await callGemini(env.GEMINI_API_KEY, base64Data, mimeType, systemPrompt, userPrompt);
    default:
      return { success: false, error: `Unknown model: ${modelName}` };
  }
}

// OpenAI GPT-4o / GPT-4o-mini Vision
async function callOpenAI(apiKey, model, base64Data, mimeType, systemPrompt, userPrompt) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const requestBody = {
    model: model,
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
    temperature: 0.1,  // Low temperature for consistent responses
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
      console.error(`OpenAI ${model} error:`, response.status, errorText);
      return { success: false, error: `OpenAI ${model} error (${response.status})` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    const usage = data.usage || null;

    if (!text) {
      return { success: false, error: 'Empty response from OpenAI' };
    }

    return { success: true, text, usage };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    console.error(`OpenAI ${model} call failed:`, err);
    return { success: false, error: 'OpenAI connection failed' };
  }
}

// Qwen3-VL-Flash with thinking mode (通义千问3视觉模型)
async function callQwenVision(apiKey, base64Data, mimeType, systemPrompt, userPrompt) {
  // Use OpenAI-compatible API endpoint for Qwen3-VL
  const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

  const requestBody = {
    model: 'qwen3-vl-flash',  // Qwen3 VL with thinking mode support
    messages: [
      {
        role: 'system',
        content: systemPrompt + '\n\nIMPORTANT: You MUST respond with valid JSON only, no markdown or extra text. Think step by step before giving the final answer.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`
            }
          },
          {
            type: 'text',
            text: userPrompt
          }
        ]
      }
    ],
    temperature: 0.1,  // Low temperature for consistent responses
    max_tokens: 8192,
    // Enable thinking mode for better reasoning on complex problems
    enable_thinking: true,
    thinking_budget: 4096  // Allow up to 4096 tokens for reasoning
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
      console.error('Qwen3-VL error:', response.status, errorText);
      return { success: false, error: `Qwen3-VL error (${response.status}): ${errorText?.substring(0, 200)}` };
    }

    const data = await response.json();
    // OpenAI-compatible format
    const text = data.choices?.[0]?.message?.content;
    const usage = data.usage || null;

    if (!text) {
      return { success: false, error: 'Empty response from Qwen-VL' };
    }

    return { success: true, text, usage };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    console.error('Qwen-VL call failed:', err);
    return { success: false, error: 'Qwen-VL connection failed' };
  }
}

// Google Gemini 3 Flash - Primary model (fast, multimodal, globally available)
// Gemini 2.0 Flash - fast multimodal model
async function callGeminiFlash(apiKey, base64Data, mimeType, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          },
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

// Google Gemini Vision (legacy/fallback)
async function callGemini(apiKey, base64Data, mimeType, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: systemPrompt + '\n\n' + userPrompt + '\n\nIMPORTANT: You MUST respond with valid JSON only, no markdown code blocks or extra text.'
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,  // Low temperature for consistent responses
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
      console.error('Gemini error:', response.status, errorText);
      return { success: false, error: `Gemini error (${response.status})` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    // Gemini doesn't return token count in same format
    const usage = {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    };

    if (!text) {
      return { success: false, error: 'Empty response from Gemini' };
    }

    return { success: true, text, usage };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    console.error('Gemini call failed:', err);
    return { success: false, error: 'Gemini connection failed' };
  }
}

// DeepSeek verification
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
