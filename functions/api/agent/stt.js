/**
 * AI Agent STT API
 * Speech-to-Text using OpenAI Whisper API
 */

export async function onRequestPost(context) {
    try {
        // Parse multipart form data
        const formData = await context.request.formData();
        const audioFile = formData.get('audio');

        if (!audioFile) {
            return Response.json({ error: 'Audio file is required' }, { status: 400 });
        }

        // Check file size (max 25MB for Whisper)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (audioFile.size > maxSize) {
            return Response.json({ error: 'Audio file too large (max 25MB)' }, { status: 400 });
        }

        // Get OpenAI API key
        const apiKey = context.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('OPENAI_API_KEY not configured');
            return Response.json({ error: 'STT service not configured' }, { status: 500 });
        }

        // Convert to a format Whisper accepts
        // The frontend sends audio/webm, which Whisper supports
        const whisperFormData = new FormData();
        whisperFormData.append('file', audioFile, 'audio.webm');
        whisperFormData.append('model', 'whisper-1');
        whisperFormData.append('language', 'zh'); // Support Chinese (Cantonese/Mandarin)
        whisperFormData.append('response_format', 'json');

        // Call OpenAI Whisper API
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
                // Don't set Content-Type - let fetch set it with boundary
            },
            body: whisperFormData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI Whisper API error:', response.status, errorText);
            return Response.json({ error: 'STT service error' }, { status: 500 });
        }

        const data = await response.json();
        const text = data.text || '';

        return Response.json({
            text: text.trim(),
            language: data.language || 'zh'
        });

    } catch (err) {
        console.error('STT error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

