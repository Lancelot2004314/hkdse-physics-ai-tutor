/**
 * Knowledge Base List API
 * Lists all documents in the knowledge base
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
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

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    const status = url.searchParams.get('status');
    const year = url.searchParams.get('year');

    // Build query
    let whereClause = '1=1';
    const params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (year) {
      whereClause += ' AND year = ?';
      params.push(parseInt(year));
    }

    // Get total count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM kb_documents WHERE ${whereClause}
    `).bind(...params).first();

    // Get documents
    const documents = await env.DB.prepare(`
      SELECT 
        d.id, d.title, d.filename, d.year, d.paper, d.source,
        d.language, d.subject, d.doc_type,
        d.chunk_count, d.status, d.error_message, 
        d.r2_key, d.gcs_uri, d.ingest_job_id, d.rag_file_name,
        d.created_at, d.updated_at, d.processed_at,
        u.email as created_by_email
      FROM kb_documents d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    return new Response(JSON.stringify({
      documents: documents.results || [],
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit),
      },
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('List error:', err);
    return errorResponse(500, 'Failed to list documents');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}


