/**
 * Knowledge Base Upload API
 * Allows admin to upload DSE past papers and learning materials
 * Supports text content (paste from PDF) or plain text files
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { generateEmbeddings, chunkDocument, EMBEDDING_DIMENSIONS } from '../../../shared/embedding.js';

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

    // Parse request
    const body = await request.json();
    const {
      title,
      content,
      year,
      paper,
      source = 'DSE',
      topics = [],
    } = body;

    if (!title || !content) {
      return errorResponse(400, 'Title and content are required');
    }

    if (content.length < 50) {
      return errorResponse(400, 'Content too short (min 50 characters)');
    }

    // Generate document ID
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Create document record
    await env.DB.prepare(`
      INSERT INTO kb_documents (id, title, year, paper, source, status, created_by)
      VALUES (?, ?, ?, ?, ?, 'processing', ?)
    `).bind(docId, title, year || null, paper || null, source, user.id).run();

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

      // Determine topic from content or use provided topics
      const detectedTopic = detectTopic(chunk.content) || (topics[0] || null);

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
          year: year || 0,
          paper: paper || '',
          question_number: chunk.questionNumber || '',
          topic: detectedTopic || '',
          content_type: detectContentType(chunk.content),
          content: chunk.content.substring(0, 1000), // Store preview in metadata
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
      message: `Successfully processed ${chunks.length} chunks`,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Upload error:', err);
    return errorResponse(500, 'Upload failed: ' + err.message);
  }
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
    'mechanics': /force|motion|velocity|acceleration|momentum|energy|work|power|newton|projectile|friction|torque/i,
    'heat': /heat|temperature|thermal|specific heat|latent|conduction|convection|radiation|calorimeter/i,
    'waves': /wave|frequency|wavelength|amplitude|sound|light|reflection|refraction|diffraction|interference/i,
    'electricity': /electric|current|voltage|resistance|circuit|ohm|capacitor|inductor|power|energy/i,
    'magnetism': /magnet|magnetic|field|electromagnetic|motor|generator|transformer|induction/i,
    'modern_physics': /atom|nuclear|radioactive|decay|half-life|photon|electron|quantum|relativity/i,
    'optics': /lens|mirror|image|focal|magnification|optical|prism|spectrum/i,
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
