/**
 * Knowledge Base Retry API
 * Resets failed documents to pending status for reprocessing
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';

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

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    // Get document ID from request body
    const body = await request.json().catch(() => ({}));
    const docId = body.docId;

    if (docId) {
      // Retry specific document
      const doc = await env.DB.prepare(`
        SELECT id, title, status, r2_key FROM kb_documents WHERE id = ?
      `).bind(docId).first();

      if (!doc) {
        return errorResponse(404, 'Document not found');
      }

      if (!doc.r2_key) {
        return errorResponse(400, 'Document has no file to reprocess');
      }

      // Reset to pending
      await env.DB.prepare(`
        UPDATE kb_documents 
        SET status = 'pending', error_message = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(docId).run();

      return new Response(JSON.stringify({
        success: true,
        message: `Document "${doc.title}" reset to pending`,
        documentId: docId,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } else {
      // Retry all failed documents
      const result = await env.DB.prepare(`
        UPDATE kb_documents 
        SET status = 'pending', error_message = NULL, updated_at = datetime('now')
        WHERE status = 'error' AND r2_key IS NOT NULL
      `).run();

      return new Response(JSON.stringify({
        success: true,
        message: `Reset ${result.meta?.changes || 0} failed documents to pending`,
        count: result.meta?.changes || 0,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

  } catch (err) {
    console.error('Retry error:', err);
    return errorResponse(500, 'Retry failed: ' + err.message);
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
