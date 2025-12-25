/**
 * Knowledge Base Process API
 * Processes pending documents from R2 (OCR + embeddings)
 * Called manually or via cron to process documents that were uploaded
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { generateEmbeddings, chunkDocument } from '../../../shared/embedding.js';

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
    // Check authentication
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    if (!env.DB || !env.R2_BUCKET || !env.VECTORIZE || !env.GEMINI_API_KEY) {
      return errorResponse(500, 'Required services not configured');
    }

    // Get one pending document
    const pendingDoc = await env.DB.prepare(`
      SELECT id, r2_key, title, year, paper, source, language, subject, doc_type
      FROM kb_documents 
      WHERE status = 'pending' AND r2_key IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 1
    `).first();

    if (!pendingDoc) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending documents to process',
        processed: 0,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { id: docId, r2_key, title, year, paper, source, language, subject, doc_type: docType } = pendingDoc;

    console.log(`Processing document: ${docId}, r2Key: ${r2_key}`);

    // Update status to processing
    await env.DB.prepare(`
      UPDATE kb_documents SET status = 'processing', updated_at = datetime('now') WHERE id = ?
    `).bind(docId).run();

    try {
      // Get file from R2
      const r2Object = await env.R2_BUCKET.get(r2_key);
      if (!r2Object) {
        throw new Error(`File not found in R2: ${r2_key}`);
      }

      const arrayBuffer = await r2Object.arrayBuffer();
      const mimeType = r2Object.customMetadata?.mimeType || 'application/pdf';

      // Extract text using OCR
      let content;
      if (mimeType === 'application/pdf') {
        content = await extractTextFromPDF(arrayBuffer, env);
      } else {
        content = await extractTextFromImage(arrayBuffer, mimeType, env);
      }

      if (!content || content.length < 50) {
        throw new Error('Content too short or extraction failed');
      }

      // Chunk the document
      const chunks = chunkDocument(content);
      if (chunks.length === 0) {
        throw new Error('Failed to chunk document');
      }

      // Generate embeddings
      const chunkTexts = chunks.map(c => c.content);
      const embeddings = await generateEmbeddings(chunkTexts, env);

      // Store chunks in D1 and Vectorize
      const vectorRecords = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${docId}_chunk_${i}`;
        const detectedTopic = detectTopic(chunk.content);

        // Store in D1
        await env.DB.prepare(`
          INSERT INTO kb_chunks (id, document_id, question_number, topic, content_type, content, embedding_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          chunkId,
          docId,
          chunk.questionNumber || null,
          detectedTopic,
          detectContentType(chunk.content),
          chunk.content,
          chunkId
        ).run();

        // Prepare for Vectorize
        vectorRecords.push({
          id: chunkId,
          values: embeddings[i],
          metadata: {
            document_id: docId,
            year: year ? parseInt(year) : 0,
            paper: paper || '',
            question_number: chunk.questionNumber || '',
            topic: detectedTopic || '',
            content_type: detectContentType(chunk.content),
            language: language || 'en',
            subject: subject || 'Physics',
            doc_type: docType || 'Past Paper',
            content: chunk.content.substring(0, 1000),
          },
        });
      }

      // Insert into Vectorize in batches
      const batchSize = 100;
      for (let i = 0; i < vectorRecords.length; i += batchSize) {
        const batch = vectorRecords.slice(i, i + batchSize);
        await env.VECTORIZE.insert(batch);
      }

      // Update document status to ready
      await env.DB.prepare(`
        UPDATE kb_documents SET status = 'ready', chunk_count = ?, processed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(chunks.length, docId).run();

      return new Response(JSON.stringify({
        success: true,
        documentId: docId,
        title: title,
        status: 'ready',
        chunkCount: chunks.length,
        contentLength: content.length,
        message: `Successfully processed: ${title}`,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } catch (err) {
      console.error(`Error processing document ${docId}:`, err);

      // Update status to error
      await env.DB.prepare(`
        UPDATE kb_documents SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(err.message, docId).run();

      return new Response(JSON.stringify({
        success: false,
        documentId: docId,
        error: err.message,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

  } catch (err) {
    console.error('Process error:', err);
    return errorResponse(500, 'Process failed: ' + err.message);
  }
}

/**
 * Extract text from PDF using Gemini 1.5 Flash (supports PDF natively)
 */
async function extractTextFromPDF(arrayBuffer, env) {
  const uint8Array = new Uint8Array(arrayBuffer);
  let base64 = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    base64 += String.fromCharCode.apply(null, chunk);
  }
  base64 = btoa(base64);

  // Use gemini-1.5-flash which has better PDF support
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  console.log(`Processing PDF: ${arrayBuffer.byteLength} bytes`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            text: `You are a document text extractor for HKDSE Physics papers. Extract ALL text content from this PDF document.

CRITICAL: You MUST extract text even if the document appears to be mostly images or scanned pages.

Instructions:
- Extract every question, answer, and explanation exactly as written
- Preserve question numbers (Q1, Q2, Q.1, etc.)
- Preserve mathematical formulas and equations (use LaTeX format like $F=ma$)
- Preserve the structure (MC options A/B/C/D, long questions, marking schemes)
- Output ONLY the extracted text, no commentary
- If there are multiple pages, extract text from all pages in order
- For Chinese text, preserve the original Chinese characters
- If you cannot extract text, describe what you see in the document`
          },
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: base64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 32000,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini OCR error:', error);
    throw new Error('OCR failed: ' + response.status + ' - ' + error.substring(0, 200));
  }

  const data = await response.json();
  console.log('Gemini response:', JSON.stringify(data).substring(0, 500));
  
  // Check for blocked content or safety issues
  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error('Content blocked by safety filter');
  }
  
  if (data.candidates?.[0]?.finishReason === 'RECITATION') {
    throw new Error('Content blocked - possible copyright issue');
  }
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    // Log the full response for debugging
    console.error('Empty OCR - full response:', JSON.stringify(data));
    const reason = data.candidates?.[0]?.finishReason || 'unknown';
    throw new Error(`Empty OCR response (reason: ${reason})`);
  }

  return text;
}

/**
 * Extract text from image using Gemini 1.5 Flash
 */
async function extractTextFromImage(arrayBuffer, mimeType, env) {
  const uint8Array = new Uint8Array(arrayBuffer);
  let base64 = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    base64 += String.fromCharCode.apply(null, chunk);
  }
  base64 = btoa(base64);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            text: `Extract ALL text from this HKDSE Physics image. Preserve question numbers, LaTeX formulas ($...$), MC options A/B/C/D. Output only the extracted text.`
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 16000,
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Image OCR error:', error);
    throw new Error('OCR failed: ' + response.status);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function detectTopic(content) {
  const topicPatterns = {
    'mechanics': /force|motion|velocity|acceleration|momentum|energy|work|power|newton|projectile|friction|力|運動|速度|加速度|動量/i,
    'heat': /heat|temperature|thermal|specific heat|latent|熱|溫度|比熱|潛熱/i,
    'waves': /wave|frequency|wavelength|sound|light|reflection|refraction|波|頻率|波長|聲|光/i,
    'electricity': /electric|current|voltage|resistance|circuit|電|電流|電壓|電阻|電路/i,
    'magnetism': /magnet|magnetic|electromagnetic|motor|generator|磁|電磁|感應/i,
    'modern_physics': /atom|nuclear|radioactive|decay|half-life|photon|electron|原子|核|放射|衰變/i,
    'optics': /lens|mirror|image|focal|magnification|透鏡|鏡|焦/i,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(content)) return topic;
  }
  return null;
}

function detectContentType(content) {
  if (/marking scheme|mark scheme|評分準則/i.test(content)) return 'marking_scheme';
  if (/answer|solution|答案/i.test(content.toLowerCase()) && content.length < 500) return 'answer';
  if (/explain|because|therefore|解釋|因為/i.test(content.toLowerCase())) return 'explanation';
  if (/\?|which|what|calculate|求|計算/i.test(content)) return 'question';
  return 'content';
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
