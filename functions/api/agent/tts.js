/**
 * AI Agent TTS API
 * Text-to-Speech using Google Cloud TTS (with OpenAI fallback)
 */

export async function onRequestPost(context) {
    try {
        const { text, voice = 'nova' } = await context.request.json();

        if (!text || typeof text !== 'string') {
            return Response.json({ error: 'Text is required' }, { status: 400 });
        }

        // Limit text length to prevent abuse
        const maxLength = 500;
        const truncatedText = text.length > maxLength 
            ? text.substring(0, maxLength) + '...' 
            : text;

        // Try Google Cloud TTS first (free tier: 4M chars/month)
        const geminiKey = context.env.GEMINI_API_KEY;
        const openaiKey = context.env.OPENAI_API_KEY;

        if (!geminiKey && !openaiKey) {
            console.error('No TTS API key configured');
            return Response.json({ error: 'TTS service not configured' }, { status: 500 });
        }

        // Try Google Cloud TTS first
        if (geminiKey) {
            const result = await callGoogleTTS(geminiKey, truncatedText);
            if (result.success) {
                return new Response(result.audioContent, {
                    headers: {
                        'Content-Type': 'audio/mpeg',
                        'Cache-Control': 'no-cache'
                    }
                });
            }
            console.warn('Google TTS failed, trying OpenAI:', result.error);
        }

        // Fallback to OpenAI TTS
        if (openaiKey) {
            const result = await callOpenAITTS(openaiKey, truncatedText, voice);
            if (result.success) {
                return new Response(result.audioStream, {
                    headers: {
                        'Content-Type': 'audio/mpeg',
                        'Cache-Control': 'no-cache'
                    }
                });
            }
            console.error('OpenAI TTS also failed:', result.error);
        }

        return Response.json({ error: 'TTS service error' }, { status: 500 });

    } catch (err) {
        console.error('TTS error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Google Cloud Text-to-Speech API (using API key)
async function callGoogleTTS(apiKey, text) {
    // Note: Google Cloud TTS requires OAuth, but we can use a simplified approach
    // For now, we'll skip Google TTS and use browser's Web Speech API on frontend
    // This is a placeholder for future Google Cloud TTS integration
    return { success: false, error: 'Google TTS requires service account' };
}

// OpenAI TTS API
async function callOpenAITTS(apiKey, text, voice) {
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice) ? voice : 'nova';

    try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: selectedVoice,
                response_format: 'mp3'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI TTS API error:', response.status, errorText);
            return { success: false, error: errorText };
        }

        return { success: true, audioStream: response.body };

    } catch (err) {
        console.error('OpenAI TTS call failed:', err);
        return { success: false, error: err.message };
    }
}

