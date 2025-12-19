/**
 * Quiz History API
 * Returns list of past quiz sessions
 */

import { getUserFromSession } from '../../../shared/auth.js';

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
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const status = url.searchParams.get('status') || 'completed';
    const search = url.searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    // Build query
    let whereClause = 'WHERE user_id = ? AND status = ?';
    const params = [user.id, status];

    if (search) {
      whereClause += ' AND topics LIKE ?';
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM quiz_sessions ${whereClause}
    `).bind(...params).first();

    // Get history
    const history = await env.DB.prepare(`
      SELECT 
        id, topics, mc_count, short_count, long_count,
        difficulty, time_limit, score, max_score, grade,
        time_spent, status, created_at, completed_at
      FROM quiz_sessions 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    // Format results with null check
    const sessions = (history.results || []).map(s => {
      let parsedTopics = [];
      try {
        parsedTopics = JSON.parse(s.topics || '[]');
      } catch (e) {
        console.error('Error parsing topics:', e);
      }

      return {
        id: s.id,
        topics: parsedTopics,
        questionCount: (s.mc_count || 0) + (s.short_count || 0) + (s.long_count || 0),
        mcCount: s.mc_count || 0,
        shortCount: s.short_count || 0,
        longCount: s.long_count || 0,
        difficulty: s.difficulty || 3,
        timeLimit: s.time_limit || 60,
        score: s.score || 0,
        maxScore: s.max_score || 0,
        percentage: s.max_score > 0 ? Math.round((s.score / s.max_score) * 100) : 0,
        grade: s.grade || 'U',
        timeSpent: s.time_spent || 0,
        status: s.status || 'completed',
        createdAt: s.created_at,
        completedAt: s.completed_at,
      };
    });

    return new Response(JSON.stringify({
      sessions,
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
    console.error('Error in quiz/history:', err);
    return errorResponse(500, 'Failed to fetch history');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
