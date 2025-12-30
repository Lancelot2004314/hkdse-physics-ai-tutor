/**
 * Test AI API connections - DEBUG ONLY
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
        hasQwenKey: !!env.QWEN_API_KEY,
        hasDeepSeekKey: !!env.DEEPSEEK_API_KEY,
        qwenKeyPrefix: env.QWEN_API_KEY ? env.QWEN_API_KEY.substring(0, 8) + '...' : null,
        qwenTest: null,
        geminiTest: null,
        deepseekTest: null,
    };

    // Test Qwen-VL first
    if (env.QWEN_API_KEY) {
        try {
            const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.QWEN_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'qwen-vl-max',
                    input: {
                        messages: [{
                            role: 'user',
                            content: [{ text: 'Say hello in 3 words' }]
                        }]
                    },
                    parameters: { max_tokens: 50 }
                }),
            });

            const data = await response.json();
            results.qwenTest = {
                status: response.ok ? 'SUCCESS' : 'FAILED',
                httpStatus: response.status,
                response: response.ok ? data.output?.choices?.[0]?.message?.content : data,
            };
        } catch (e) {
            results.qwenTest = { status: 'ERROR', error: e.message };
        }
    }

    // Test DeepSeek
    if (env.DEEPSEEK_API_KEY) {
        try {
            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: 'Say hello in 3 words' }],
                    max_tokens: 50
                }),
            });

            const data = await response.json();
            results.deepseekTest = {
                status: response.ok ? 'SUCCESS' : 'FAILED',
                httpStatus: response.status,
                response: response.ok ? data.choices?.[0]?.message?.content : data.error,
            };
        } catch (e) {
            results.deepseekTest = { status: 'ERROR', error: e.message };
        }
    }

    // Test Gemini (might be blocked in some regions)
    if (env.GEMINI_API_KEY) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Say hello in 3 words' }] }],
                    generationConfig: { maxOutputTokens: 50 }
                }),
            });

            const data = await response.json();
            results.geminiTest = {
                status: response.ok ? 'SUCCESS' : 'FAILED',
                httpStatus: response.status,
                response: response.ok ? data.candidates?.[0]?.content?.parts?.[0]?.text : data.error?.message,
            };
        } catch (e) {
            results.geminiTest = { status: 'ERROR', error: e.message };
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

