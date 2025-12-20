/**
 * Knowledge Base Upload API
 * Allows admin to upload DSE past papers and learning materials
 * Supports:
 * - Text content (paste from PDF)
 * - PDF file upload with OCR via GPT-4o Vision
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { generateEmbeddings, chunkDocument, EMBEDDING_DIMENSIONS } from '../../../shared/embedding.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max for PDF

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

    // Check admin permission
    if (!isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    // Check required bindings
    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }
    if (!env.VECTORIZE) {
      return errorResponse(500, 'Vectorize not configured');
    }
    if (!env.OPENAI_API_KEY) {
      return errorResponse(500, 'OpenAI API key not configured');
    }

    // Check content type
    const contentType = request.headers.get('Content-Type') || '';

    let title, content, year, paper, source, filename;

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file');
      title = formData.get('title');
      year = formData.get('year');
      paper = formData.get('paper');
      source = formData.get('source') || 'DSE';

      if (!file || !title) {
        return errorResponse(400, 'File and title are required');
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(400, 'File too large (max 10MB)');
      }

      filename = file.name;
      const fileType = file.type;

      // Check if it's a PDF or image
      if (fileType === 'application/pdf') {
        // For PDF, we need to extract text using OCR
        content = await extractTextFromPDF(file, env);
      } else if (fileType.startsWith('image/')) {
        // For images, use GPT-4o Vision directly
        content = await extractTextFromImage(file, env);
      } else {
        return errorResponse(400, 'Unsupported file type. Please upload PDF or image.');
      }

      // Store original file in R2 if available
      if (env.R2_BUCKET) {
        const fileId = `${Date.now()}_${filename}`;
        const arrayBuffer = await file.arrayBuffer();
        await env.R2_BUCKET.put(fileId, arrayBuffer, {
          customMetadata: { title, year: year || '', paper: paper || '' },
        });
      }

    } else {
      // Handle JSON body (text content)
      const body = await request.json();
      title = body.title;
      content = body.content;
      year = body.year;
      paper = body.paper;
      source = body.source || 'DSE';

      if (!title || !content) {
        return errorResponse(400, 'Title and content are required');
      }
    }

    if (!content || content.length < 50) {
      return errorResponse(400, 'Content too short or extraction failed (min 50 characters)');
    }

    // Generate document ID
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Create document record
    await env.DB.prepare(`
      INSERT INTO kb_documents (id, title, filename, year, paper, source, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'processing', ?)
    `).bind(docId, title, filename || null, year || null, paper || null, source, user.id).run();

    // Chunk the document
    const chunks = chunkDocument(content);

    if (chunks.length === 0) {
      await updateDocumentStatus(env.DB, docId, 'error');
      return errorResponse(400, 'Failed to chunk document');
    }

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map(c => c.content);
    let embeddings;

    try {
      embeddings = await generateEmbeddings(chunkTexts, env);
    } catch (err) {
      console.error('Embedding generation failed:', err);
      await updateDocumentStatus(env.DB, docId, 'error');
      return errorResponse(500, 'Failed to generate embeddings');
    }

    // Store chunks in D1 and Vectorize
    const vectorRecords = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `${docId}_chunk_${i}`;

      // Determine topic from content
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

    // Update document status
    await env.DB.prepare(`
      UPDATE kb_documents SET status = 'ready', chunk_count = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(chunks.length, docId).run();

    return new Response(JSON.stringify({
      success: true,
      documentId: docId,
      chunkCount: chunks.length,
      contentLength: content.length,
      message: `Successfully processed ${chunks.length} chunks from ${content.length} characters`,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Upload error:', err);
    return errorResponse(500, 'Upload failed: ' + err.message);
  }
}

/**
 * Extract text from PDF using GPT-4o Vision
 * Converts PDF pages to images and uses OCR
 */
async function extractTextFromPDF(file, env) {
  // Read file as base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  // For PDF, we'll send it to GPT-4o and ask it to extract all text
  // Note: GPT-4o can process PDF directly in some cases, but for better results
  // we describe it as a document extraction task

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a document text extractor. Extract ALL text content from the provided document image(s).
          
Important instructions:
- Extract every question, answer, and explanation exactly as written
- Preserve question numbers (Q1, Q2, etc.)
- Preserve mathematical formulas and equations
- Preserve the structure (MC options A/B/C/D, long questions, etc.)
- Output ONLY the extracted text, no commentary
- If there are multiple pages, extract text from all pages in order`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64}`,
                detail: 'high'
              }
            },
            {
              type: 'text',
              text: 'Extract all text content from this HKDSE Physics document. Include all questions, answers, and marking schemes.'
            }
          ]
        }
      ],
      max_tokens: 16000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('GPT-4o OCR error:', error);
    throw new Error('Failed to extract text from PDF');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Extract text from image using GPT-4o Vision
 */
async function extractTextFromImage(file, env) {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const mimeType = file.type;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a document text extractor. Extract ALL text content from the image.
          
Important instructions:
- Extract every question, answer, and explanation exactly as written
- Preserve question numbers (Q1, Q2, etc.)
- Preserve mathematical formulas and equations
- Output ONLY the extracted text, no commentary`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high'
              }
            },
            {
              type: 'text',
              text: 'Extract all text content from this HKDSE Physics document image.'
            }
          ]
        }
      ],
      max_tokens: 8000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('GPT-4o OCR error:', error);
    throw new Error('Failed to extract text from image');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function updateDocumentStatus(db, docId, status) {
  await db.prepare(`
    UPDATE kb_documents SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(status, docId).run();
}

/**
 * Detect physics topic from content
 */
function detectTopic(content) {
  const topicPatterns = {
    'mechanics': /force|motion|velocity|acceleration|momentum|energy|work|power|newton|projectile|friction|torque|力|運動|速度|加速度|動量/i,
    'heat': /heat|temperature|thermal|specific heat|latent|conduction|convection|radiation|calorimeter|熱|溫度|比熱|潛熱/i,
    'waves': /wave|frequency|wavelength|amplitude|sound|light|reflection|refraction|diffraction|interference|波|頻率|波長|聲|光/i,
    'electricity': /electric|current|voltage|resistance|circuit|ohm|capacitor|inductor|power|電|電流|電壓|電阻|電路/i,
    'magnetism': /magnet|magnetic|field|electromagnetic|motor|generator|transformer|induction|磁|電磁|感應/i,
    'modern_physics': /atom|nuclear|radioactive|decay|half-life|photon|electron|quantum|relativity|原子|核|放射|衰變|半衰期/i,
    'optics': /lens|mirror|image|focal|magnification|optical|prism|spectrum|透鏡|鏡|焦/i,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(content)) {
      return topic;
    }
  }

  return null;
}

/**
 * Detect content type from text
 */
function detectContentType(content) {
  const lowerContent = content.toLowerCase();

  if (/marking scheme|mark scheme|分配分數|評分準則/i.test(content)) {
    return 'marking_scheme';
  }
  if (/answer|solution|解答|答案/i.test(lowerContent) && content.length < 500) {
    return 'answer';
  }
  if (/explain|because|therefore|hence|解釋|因為|所以/i.test(lowerContent)) {
    return 'explanation';
  }
  if (/\?\s*$|which|what|calculate|find|determine|求|計算/i.test(content)) {
    return 'question';
  }

  return 'content';
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
