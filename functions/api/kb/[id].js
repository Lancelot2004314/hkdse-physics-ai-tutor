/**
 * Knowledge Base Document API
 * GET: Get document details with chunks
 * DELETE: Delete document and its chunks
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const docId = params.id;

    // Get document
    const document = await env.DB.prepare(`
      SELECT 
        d.*, u.email as created_by_email
      FROM kb_documents d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.id = ?
    `).bind(docId).first();

    if (!document) {
      return errorResponse(404, 'Document not found');
    }

    // Get chunks
    const chunks = await env.DB.prepare(`
      SELECT id, question_number, topic, content_type, content, created_at
      FROM kb_chunks
      WHERE document_id = ?
      ORDER BY id
    `).bind(docId).all();

    return new Response(JSON.stringify({
      document,
      chunks: chunks.results || [],
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Get document error:', err);
    return errorResponse(500, 'Failed to get document');
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const docId = params.id;

    // Get chunk IDs for Vectorize deletion
    const chunks = await env.DB.prepare(`
      SELECT embedding_id FROM kb_chunks WHERE document_id = ?
    `).bind(docId).all();

    const chunkIds = (chunks.results || []).map(c => c.embedding_id).filter(Boolean);

    // Delete from Vectorize
    if (env.VECTORIZE && chunkIds.length > 0) {
      try {
        await env.VECTORIZE.deleteByIds(chunkIds);
      } catch (err) {
        console.error('Vectorize deletion error:', err);
        // Continue with D1 deletion even if Vectorize fails
      }
    }

    // Delete chunks from D1
    await env.DB.prepare(`
      DELETE FROM kb_chunks WHERE document_id = ?
    `).bind(docId).run();

    // Delete document from D1
    const result = await env.DB.prepare(`
      DELETE FROM kb_documents WHERE id = ?
    `).bind(docId).run();

    if (result.meta?.changes === 0) {
      return errorResponse(404, 'Document not found');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Document deleted',
      deletedChunks: chunkIds.length,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Delete document error:', err);
    return errorResponse(500, 'Failed to delete document');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}



