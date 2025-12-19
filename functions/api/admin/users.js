/**
 * HKDSE Physics AI Tutor - Admin Users API
 * List all users with their token usage
 */

import { jsonResponse, errorResponse, corsHeaders } from '../../../shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    const total = countResult?.count || 0;

    // Get users with token usage and history count
    const users = await env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        COALESCE(h.history_count, 0) as history_count,
        COALESCE(t.total_tokens, 0) as total_tokens,
        COALESCE(t.request_count, 0) as request_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as history_count
        FROM history
        GROUP BY user_id
      ) h ON u.id = h.user_id
      LEFT JOIN (
        SELECT user_id, SUM(total_tokens) as total_tokens, COUNT(*) as request_count
        FROM token_usage
        GROUP BY user_id
      ) t ON u.id = t.user_id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return jsonResponse({
      users: users.results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error('Error fetching users:', err);
    return errorResponse(500, '獲取用戶列表失敗');
  }
}
