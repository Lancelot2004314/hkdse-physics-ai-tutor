/**
 * AI Agent TTS API
 * Text-to-Speech using OpenAI TTS API
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

        // Get OpenAI API key
        const apiKey = context.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('OPENAI_API_KEY not configured');
            return Response.json({ error: 'TTS service not configured' }, { status: 500 });
        }

        // Valid voices: alloy, echo, fable, onyx, nova, shimmer
        const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
        const selectedVoice = validVoices.includes(voice) ? voice : 'nova';

        // Call OpenAI TTS API
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: truncatedText,
                voice: selectedVoice,
                response_format: 'mp3'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI TTS API error:', response.status, errorText);
            return Response.json({ error: 'TTS service error' }, { status: 500 });
        }

        // Return the audio stream
        return new Response(response.body, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-cache'
            }
        });

    } catch (err) {
        console.error('TTS error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

