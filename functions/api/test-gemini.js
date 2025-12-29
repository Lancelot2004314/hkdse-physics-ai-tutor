/**
 * Test Gemini API connection - DEBUG ONLY
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env } = context;

  const results = {
    hasGeminiKey: !!env.GEMINI_API_KEY,
    keyPrefix: env.GEMINI_API_KEY ? env.GEMINI_API_KEY.substring(0, 10) + '...' : null,
    testResult: null,
    error: null,
    modelsAvailable: null,
  };

  if (!env.GEMINI_API_KEY) {
    results.error = 'GEMINI_API_KEY not configured';
    return jsonResponse(results);
  }

  // First, list available models
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();
    
    if (listData.models) {
      results.modelsAvailable = listData.models
        .filter(m => m.name.includes('gemini'))
        .map(m => ({
          name: m.name,
          displayName: m.displayName,
          supportedMethods: m.supportedGenerationMethods
        }))
        .slice(0, 15); // Limit to 15
    } else {
      results.modelsAvailable = listData;
    }
  } catch (e) {
    results.modelsAvailable = { error: e.message };
  }

  // Try gemini-3.0-flash first
  const modelsToTry = ['gemini-3.0-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash'];
  
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "Hello, I am working!" in exactly 5 words.' }] }],
          generationConfig: { maxOutputTokens: 50 }
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        results.testResult = {
          model: model,
          status: 'SUCCESS',
          response: data.candidates[0].content.parts[0].text,
        };
        break; // Found working model
      } else {
        results.testResult = {
          model: model,
          status: 'FAILED',
          httpStatus: response.status,
          error: data.error?.message || JSON.stringify(data).substring(0, 200),
        };
      }
    } catch (e) {
      results.testResult = {
        model: model,
        status: 'ERROR',
        error: e.message,
      };
    }
  }

  return jsonResponse(results);
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

