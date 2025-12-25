/**
 * Knowledge Base Re-ingest API
 * Re-trigger Vertex RAG Engine import for failed documents
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { uploadToGcs, ragImportDocument, checkVertexConfig } from '../../../shared/vertexRag.js';

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
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    const vertexConfig = checkVertexConfig(env);
    if (!vertexConfig.configured) {
      return errorResponse(500, 'Vertex AI RAG Engine not configured');
    }

    const body = await request.json().catch(() => ({}));
    const { documentId } = body;

    // Get failed documents
    let query, params;
    if (documentId) {
      query = `SELECT * FROM kb_documents WHERE id = ? AND status = 'error'`;
      params = [documentId];
    } else {
      query = `SELECT * FROM kb_documents WHERE status = 'error' LIMIT 10`;
      params = [];
    }

    const result = await env.DB.prepare(query).bind(...params).all();
    const failedDocs = result.results || [];

    if (failedDocs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No failed documents to re-ingest',
        count: 0,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let successCount = 0;
    let errorCount = 0;

    for (const doc of failedDocs) {
      try {
        // Check if we have a GCS URI
        if (!doc.gcs_uri) {
          // Document was uploaded before Vertex migration, skip
          console.log(`Document ${doc.id} has no GCS URI, cannot re-ingest`);
          continue;
        }

        // Re-trigger RAG import
        const importResult = await ragImportDocument(env, doc.gcs_uri, {
          title: doc.title,
          year: doc.year,
          paper: doc.paper,
          language: doc.language,
          subject: doc.subject,
          docType: doc.doc_type,
        }, {
          useLayoutParser: true,
          chunkSize: 1024,
          chunkOverlap: 256,
        });

        // Update document status
        await env.DB.prepare(`
          UPDATE kb_documents
          SET status = 'processing', ingest_job_id = ?, error_message = NULL, updated_at = datetime('now')
          WHERE id = ?
        `).bind(importResult.operationName, doc.id).run();

        successCount++;
      } catch (err) {
        console.error(`Failed to re-ingest ${doc.id}:`, err);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Re-ingestion started for ${successCount} documents`,
      successCount,
      errorCount,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Re-ingest error:', err);
    return errorResponse(500, 'Re-ingest failed: ' + err.message);
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
