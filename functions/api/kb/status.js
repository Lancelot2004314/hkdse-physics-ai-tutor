/**
 * Knowledge Base Status API
 * Check Vertex RAG import operation status and update D1 records
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { checkImportStatus, checkVertexConfig } from '../../../shared/vertexRag.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

/**
 * GET /api/kb/status - Check status of all processing documents
 * POST /api/kb/status - Check specific document or operation
 */
export async function onRequest(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    if (request.method === 'GET') {
      return await checkAllProcessingDocuments(env);
    } else if (request.method === 'POST') {
      const body = await request.json();
      return await checkSpecificDocument(env, body.documentId, body.operationName);
    }

    return errorResponse(405, 'Method not allowed');

  } catch (err) {
    console.error('Status check error:', err);
    return errorResponse(500, 'Status check failed: ' + err.message);
  }
}

/**
 * Check all documents with 'processing' status
 */
async function checkAllProcessingDocuments(env) {
  const vertexConfig = checkVertexConfig(env);

  if (!vertexConfig.configured) {
    return new Response(JSON.stringify({
      success: true,
      message: 'Vertex RAG not configured',
      documents: [],
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Get all processing documents
  const result = await env.DB.prepare(`
    SELECT id, title, status, ingest_job_id, gcs_uri, created_at
    FROM kb_documents
    WHERE status = 'processing' AND ingest_job_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 50
  `).all();

  const documents = result.results || [];
  const statusUpdates = [];

  for (const doc of documents) {
    if (doc.ingest_job_id) {
      try {
        const opStatus = await checkImportStatus(env, doc.ingest_job_id);

        if (opStatus.done) {
          if (opStatus.error) {
            // Import failed
            await env.DB.prepare(`
              UPDATE kb_documents
              SET status = 'error', error_message = ?, processed_at = datetime('now'), updated_at = datetime('now')
              WHERE id = ?
            `).bind(opStatus.error.message || 'Import failed', doc.id).run();

            statusUpdates.push({
              id: doc.id,
              title: doc.title,
              previousStatus: 'processing',
              newStatus: 'error',
              error: opStatus.error.message,
            });
          } else {
            // Import succeeded
            const ragFileName = opStatus.response?.importRagFilesResponse?.importedRagFilesCount
              ? `${doc.ingest_job_id.split('/operations/')[0]}/ragFiles/...`
              : null;

            await env.DB.prepare(`
              UPDATE kb_documents
              SET status = 'ready', rag_file_name = ?, processed_at = datetime('now'), updated_at = datetime('now')
              WHERE id = ?
            `).bind(ragFileName, doc.id).run();

            statusUpdates.push({
              id: doc.id,
              title: doc.title,
              previousStatus: 'processing',
              newStatus: 'ready',
            });
          }
        } else {
          statusUpdates.push({
            id: doc.id,
            title: doc.title,
            status: 'processing',
            progress: opStatus.metadata?.progressPercent || 0,
          });
        }
      } catch (err) {
        console.error(`Failed to check status for ${doc.id}:`, err);
        statusUpdates.push({
          id: doc.id,
          title: doc.title,
          status: 'processing',
          checkError: err.message,
        });
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    totalProcessing: documents.length,
    updates: statusUpdates,
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/**
 * Check specific document status
 */
async function checkSpecificDocument(env, documentId, operationName) {
  if (!documentId && !operationName) {
    return errorResponse(400, 'documentId or operationName required');
  }

  let doc = null;
  let opName = operationName;

  if (documentId) {
    const result = await env.DB.prepare(`
      SELECT id, title, status, ingest_job_id, gcs_uri, error_message
      FROM kb_documents
      WHERE id = ?
    `).bind(documentId).first();

    if (!result) {
      return errorResponse(404, 'Document not found');
    }

    doc = result;
    opName = result.ingest_job_id;
  }

  if (!opName) {
    return new Response(JSON.stringify({
      success: true,
      document: doc,
      message: 'No operation to check (document may use local processing)',
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const vertexConfig = checkVertexConfig(env);
  if (!vertexConfig.configured) {
    return errorResponse(500, 'Vertex RAG not configured');
  }

  try {
    const opStatus = await checkImportStatus(env, opName);

    if (opStatus.done && doc) {
      // Update document status
      if (opStatus.error) {
        await env.DB.prepare(`
          UPDATE kb_documents
          SET status = 'error', error_message = ?, processed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).bind(opStatus.error.message || 'Import failed', doc.id).run();
      } else {
        await env.DB.prepare(`
          UPDATE kb_documents
          SET status = 'ready', processed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).bind(doc.id).run();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      document: doc,
      operation: {
        name: opName,
        done: opStatus.done,
        error: opStatus.error,
        metadata: opStatus.metadata,
      },
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    return errorResponse(500, 'Failed to check operation: ' + err.message);
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
