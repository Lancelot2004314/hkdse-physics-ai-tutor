/**
 * HKDSE Physics AI Tutor - List History API
 * Returns user's problem history
 */

import {
  getUserFromSession,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from '../../../shared/auth.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // Check authentication
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, '請先登入');
    }

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get('limit')) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    // Get history count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM history WHERE user_id = ?
    `).bind(user.id).first();

    // Get history items
    const historyResult = await env.DB.prepare(`
      SELECT id, kind, problem_summary, created_at
      FROM history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.id, limit, offset).all();

    return jsonResponse({
      items: historyResult.results.map(item => ({
        id: item.id,
        kind: item.kind,
        problemSummary: item.problem_summary,
        createdAt: item.created_at,
      })),
      total: countResult.total,
      limit,
      offset,
    });

  } catch (err) {
    console.error('Error in history/list:', err);
    return errorResponse(500, '載入失敗，請重試');
  }
}
