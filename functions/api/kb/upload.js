/**
 * Knowledge Base Upload API - Vertex AI RAG Engine Version
 * Stores file in GCS and triggers Vertex RAG Engine import
 * Falls back to local Vectorize for text-only uploads
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { uploadToGcs, ragImportDocument, checkVertexConfig } from '../../../shared/vertexRag.js';
import { generateEmbeddings, chunkDocument } from '../../../shared/embedding.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB max for PDF (GCS handles larger files)

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

    // Check Vertex AI configuration
    const vertexConfig = checkVertexConfig(env);
    const useVertexRag = vertexConfig.configured;

    // Check content type
    const contentType = request.headers.get('Content-Type') || '';

    let title, content, year, paper, source, filename, language, subject, docType;
    let isFileUpload = false;
    let fileData = null;
    let fileMimeType = null;

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file');
      title = formData.get('title');
      year = formData.get('year');
      paper = formData.get('paper');
      source = formData.get('source') || 'DSE';
      language = formData.get('language') || 'en';
      subject = formData.get('subject') || 'Physics';
      docType = formData.get('docType') || 'Past Paper';

      if (!file || !title) {
        return errorResponse(400, 'File and title are required');
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(400, 'File too large (max 20MB)');
      }

      filename = file.name;
      fileMimeType = file.type;

      // Validate file type
      if (fileMimeType !== 'application/pdf' && !fileMimeType.startsWith('image/')) {
        return errorResponse(400, 'Unsupported file type. Please upload PDF or image.');
      }

      isFileUpload = true;
      fileData = await file.arrayBuffer();

    } else {
      // Handle JSON body (text content)
      const body = await request.json();
      title = body.title;
      content = body.content;
      year = body.year;
      paper = body.paper;
      source = body.source || 'DSE';
      language = body.language || 'en';
      subject = body.subject || 'Physics';
      docType = body.docType || 'Past Paper';

      if (!title || !content) {
        return errorResponse(400, 'Title and content are required');
      }

      if (content.length < 50) {
        return errorResponse(400, 'Content too short (min 50 characters)');
      }
    }

    // Generate document ID
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (isFileUpload && useVertexRag) {
      // Use Vertex AI RAG Engine for file uploads
      return await uploadToVertexRag(env, user, docId, {
        title,
        filename,
        fileData,
        fileMimeType,
        year,
        paper,
        source,
        language,
        subject,
        docType,
      });
    } else if (isFileUpload && !useVertexRag) {
      // Fallback: Store in R2 if Vertex not configured
      if (!env.R2_BUCKET) {
        return errorResponse(500, 'Neither Vertex RAG nor R2 storage configured');
      }

      const r2Key = `uploads/${Date.now()}_${filename}`;
      await env.R2_BUCKET.put(r2Key, fileData, {
        customMetadata: {
          title,
          year: year || '',
          paper: paper || '',
          language,
          subject,
          docType,
          mimeType: fileMimeType
        },
      });

      // Create document record with pending status
      await env.DB.prepare(`
        INSERT INTO kb_documents (id, title, filename, year, paper, source, language, subject, doc_type, status, r2_key, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        docId, title, filename, year || null, paper || null, source,
        language, subject, docType, 'pending', r2Key, user.id
      ).run();

      return new Response(JSON.stringify({
        success: true,
        documentId: docId,
        status: 'pending',
        message: 'File uploaded to R2. Process manually via /api/kb/process.',
        backend: 'r2_fallback',
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } else {
      // Text content - use local Vectorize (fallback path)
      await env.DB.prepare(`
        INSERT INTO kb_documents (id, title, year, paper, source, language, subject, doc_type, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        docId, title, year || null, paper || null, source,
        language, subject, docType, 'processing', user.id
      ).run();

      return await processTextContent(env, docId, content, { year, paper, language, subject, docType });
    }

  } catch (err) {
    console.error('Upload error:', err);
    return errorResponse(500, 'Upload failed: ' + err.message);
  }
}

/**
 * Upload file to GCS and trigger Vertex RAG import
 */
async function uploadToVertexRag(env, user, docId, params) {
  const { title, filename, fileData, fileMimeType, year, paper, source, language, subject, docType } = params;

  try {
    // Create GCS object path
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsObjectPath = `documents/${year || 'unknown'}/${sanitizedFilename}`;

    // Prepare metadata for GCS
    const metadata = {
      title,
      year: year || '',
      paper: paper || '',
      language,
      subject,
      docType,
      source,
      uploadedBy: user.email,
      documentId: docId,
    };

    // Upload to GCS
    console.log(`Uploading ${filename} to GCS...`);
    const gcsUri = await uploadToGcs(env, new Uint8Array(fileData), gcsObjectPath, fileMimeType, metadata);
    console.log(`Uploaded to: ${gcsUri}`);

    // Create document record with processing status
    await env.DB.prepare(`
      INSERT INTO kb_documents (id, title, filename, year, paper, source, language, subject, doc_type, status, gcs_uri, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      docId, title, filename, year || null, paper || null, source,
      language, subject, docType, 'processing', gcsUri, user.id
    ).run();

    // Trigger Vertex RAG import with Document AI layout parser
    console.log('Triggering Vertex RAG import...');
    const importResult = await ragImportDocument(env, gcsUri, metadata, {
      useLayoutParser: true,
      chunkSize: 1024,
      chunkOverlap: 256,
    });
    console.log(`Import operation: ${importResult.operationName}`);

    // Update document with operation ID
    await env.DB.prepare(`
      UPDATE kb_documents SET ingest_job_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(importResult.operationName, docId).run();

    return new Response(JSON.stringify({
      success: true,
      documentId: docId,
      status: 'processing',
      gcsUri,
      operationName: importResult.operationName,
      message: 'File uploaded to GCS and RAG import started. Check status for progress.',
      backend: 'vertex_rag',
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Vertex RAG upload error:', err);

    // Update document status to error
    try {
      await env.DB.prepare(`
        UPDATE kb_documents SET status = 'error', error_message = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(err.message, docId).run();
    } catch (dbErr) {
      console.error('Failed to update error status:', dbErr);
    }

    return errorResponse(500, 'Vertex RAG upload failed: ' + err.message);
  }
}

/**
 * Process text content with local Vectorize (fallback for JSON uploads)
 */
async function processTextContent(env, docId, content, metadata) {
  try {
    if (!env.VECTORIZE) {
      await updateDocumentStatus(env.DB, docId, 'error', 'Vectorize not configured');
      return errorResponse(500, 'Vectorize not configured for text processing');
    }

    // Chunk the document
    const chunks = chunkDocument(content);

    if (chunks.length === 0) {
      await updateDocumentStatus(env.DB, docId, 'error', 'Failed to chunk document');
      return errorResponse(400, 'Failed to chunk document');
    }

    // Generate embeddings for all chunks
    const chunkTexts = chunks.map(c => c.content);
    let embeddings;

    try {
      embeddings = await generateEmbeddings(chunkTexts, env);
    } catch (err) {
      console.error('Embedding generation failed:', err);
      await updateDocumentStatus(env.DB, docId, 'error', 'Failed to generate embeddings: ' + err.message);
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
          year: metadata.year ? parseInt(metadata.year) : 0,
          paper: metadata.paper || '',
          question_number: chunk.questionNumber || '',
          topic: detectedTopic || '',
          content_type: detectContentType(chunk.content),
          language: metadata.language || 'en',
          subject: metadata.subject || 'Physics',
          doc_type: metadata.docType || 'Past Paper',
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
      UPDATE kb_documents SET status = 'ready', chunk_count = ?, processed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(chunks.length, docId).run();

    return new Response(JSON.stringify({
      success: true,
      documentId: docId,
      status: 'ready',
      chunkCount: chunks.length,
      contentLength: content.length,
      message: `Successfully processed ${chunks.length} chunks`,
      backend: 'vectorize',
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Processing error:', err);
    await updateDocumentStatus(env.DB, docId, 'error', err.message);
    return errorResponse(500, 'Processing failed: ' + err.message);
  }
}

async function updateDocumentStatus(db, docId, status, errorMessage = null) {
  await db.prepare(`
    UPDATE kb_documents SET status = ?, error_message = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(status, errorMessage, docId).run();
}

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
