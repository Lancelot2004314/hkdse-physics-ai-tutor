/**
 * HKDSE Physics AI Tutor - OCR API
 * Cloudflare Pages Function
 * Uses Qwen-VL for text recognition from images
 */

const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB
const OCR_TIMEOUT = 30000; // 30 seconds

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
    const { image } = body;

    // Validate image
    if (!image) {
      return errorResponse(400, '請上傳圖片 / Please upload an image');
    }

    // Check image size (base64 encoded)
    const imageSize = (image.length * 3) / 4;
    if (imageSize > MAX_IMAGE_SIZE) {
      return errorResponse(400, '圖片太大，請壓縮至 3MB 以下 / Image too large');
    }

    // Check API key
    if (!env.QWEN_API_KEY) {
      return errorResponse(500, 'OCR 服務未配置 / OCR service not configured');
    }

    // Extract base64 data
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    // Call Qwen-VL for OCR
    const ocrResult = await extractTextWithQwen(env.QWEN_API_KEY, base64Data, mimeType);

    if (ocrResult.success) {
      return new Response(JSON.stringify({ 
        text: ocrResult.text,
        success: true
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } else {
      return errorResponse(500, ocrResult.error || 'OCR 識別失敗');
    }

  } catch (err) {
    console.error('OCR API error:', err);
    return errorResponse(500, '處理失敗，請重試 / Processing failed');
  }
}

/**
 * Extract text from image using Qwen-VL
 * Optimized for handwritten and printed text, including math formulas
 */
async function extractTextWithQwen(apiKey, base64Data, mimeType) {
  const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

  // OCR prompt optimized for math and handwriting
  const ocrPrompt = `你是一個專業的 OCR 文字識別系統，專門識別數學公式和手寫文字。

請仔細識別這張圖片中的所有內容：

要求：
1. 提取圖片中的所有可見文字（包括模糊的文字）
2. 數學公式使用 LaTeX 格式，用 $ 符號包圍，例如 $x^2 + 2x + 1$
3. 如果是分數，使用 $\\frac{a}{b}$ 格式
4. 如果是根號，使用 $\\sqrt{x}$ 格式
5. 如果某些文字模糊難以辨認，請盡力推測最可能的內容
6. 保持原有的格式和換行
7. 只輸出識別到的文字和公式，不要添加任何解釋

直接輸出識別結果：`;

  const requestBody = {
    model: 'qwen-vl-max',
    messages: [
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
            text: ocrPrompt
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 2048
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
      const errorText = await response.text().catch(() => '');
      console.error('Qwen OCR error:', response.status, errorText);
      return { success: false, error: `OCR 服務錯誤 (${response.status})` };
    }

    const data = await response.json();
    
    // OpenAI-compatible format
    let text = data.choices?.[0]?.message?.content;
    
    // Handle array content
    if (Array.isArray(text)) {
      text = text.map(item => item.text || item.content || '').join('');
    }

    if (!text || text.length < 1) {
      return { success: false, error: '未能識別到文字' };
    }

    // Clean up the text
    const cleanedText = text.trim();

    return { success: true, text: cleanedText };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '識別超時，請重試' };
    }
    console.error('Qwen OCR call failed:', err);
    return { success: false, error: 'OCR 連接失敗' };
  }
}

function errorResponse(status, message) {
  return new Response(
    JSON.stringify({ error: message, success: false }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}






