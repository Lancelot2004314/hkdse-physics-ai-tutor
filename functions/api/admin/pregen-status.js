/**
 * Admin Pregen Status API
 * Query job status and logs for the terminal-like progress viewer
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
    // Check admin auth
    const user = await getUserFromSession(request, env);
    if (!user || !isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (jobId) {
      // Get specific job details
      const result = await env.DB.prepare(`
        SELECT * FROM pregen_jobs WHERE id = ?
      `).bind(jobId).first();

      if (!result) {
        return errorResponse(404, 'Job not found');
      }

      return new Response(JSON.stringify({
        job: {
          id: result.id,
          subtopic: result.subtopic,
          language: result.language,
          qtype: result.qtype,
          difficulty: result.difficulty,
          targetCount: result.target_count,
          completedCount: result.completed_count,
          failedCount: result.failed_count,
          status: result.status,
          logs: result.logs,
          errorMessage: result.error_message,
          startedAt: result.started_at,
          finishedAt: result.finished_at,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        },
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // List recent jobs
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const statusFilter = url.searchParams.get('status');

    let query = 'SELECT * FROM pregen_jobs';
    const params = [];

    if (statusFilter) {
      query += ' WHERE status = ?';
      params.push(statusFilter);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM pregen_jobs';
    if (statusFilter) {
      countQuery += ' WHERE status = ?';
    }
    const countResult = statusFilter
      ? await env.DB.prepare(countQuery).bind(statusFilter).first()
      : await env.DB.prepare(countQuery).first();

    const jobs = (result.results || []).map(row => ({
      id: row.id,
      subtopic: row.subtopic,
      language: row.language,
      qtype: row.qtype,
      targetCount: row.target_count,
      completedCount: row.completed_count,
      failedCount: row.failed_count,
      status: row.status,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
    }));

    return new Response(JSON.stringify({
      jobs,
      total: countResult?.total || 0,
      limit,
      offset,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in admin/pregen-status:', err);
    return errorResponse(500, 'Failed to get pregen status: ' + err.message);
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
