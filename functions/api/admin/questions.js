/**
 * Admin Questions API
 * Fetch questions from the question bank for preview
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

    // Parse query params
    const url = new URL(request.url);
    const subtopic = url.searchParams.get('subtopic') || '';
    const language = url.searchParams.get('language') || '';
    const qtype = url.searchParams.get('qtype') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Build query
    let query = 'SELECT id, topic_key, language, qtype, difficulty, question_json, status, created_at FROM question_bank WHERE 1=1';
    const params = [];

    if (subtopic) {
      query += ' AND topic_key = ?';
      params.push(subtopic);
    }
    if (language) {
      query += ' AND language = ?';
      params.push(language);
    }
    if (qtype) {
      query += ' AND qtype = ?';
      params.push(qtype);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    // Parse question_json for each result
    const questions = (result.results || []).map(row => {
      let parsed = {};
      try {
        parsed = JSON.parse(row.question_json);
      } catch { }
      return {
        id: row.id,
        topicKey: row.topic_key,
        language: row.language,
        qtype: row.qtype,
        difficulty: row.difficulty,
        status: row.status,
        createdAt: row.created_at,
        ...parsed,
      };
    });

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM question_bank WHERE 1=1';
    const countParams = [];
    if (subtopic) {
      countQuery += ' AND topic_key = ?';
      countParams.push(subtopic);
    }
    if (language) {
      countQuery += ' AND language = ?';
      countParams.push(language);
    }
    if (qtype) {
      countQuery += ' AND qtype = ?';
      countParams.push(qtype);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    return new Response(JSON.stringify({
      questions,
      total: countResult?.total || 0,
      limit,
      offset,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in admin/questions:', err);
    return errorResponse(500, 'Failed to get questions: ' + err.message);
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
