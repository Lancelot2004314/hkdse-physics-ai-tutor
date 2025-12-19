/**
 * HKDSE Physics AI Tutor - Admin History API
 * List all history records
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
    const userId = url.searchParams.get('user_id');
    const offset = (page - 1) * limit;

    // Build query based on filters
    let countQuery = 'SELECT COUNT(*) as count FROM history';
    let dataQuery = `
      SELECT 
        h.id,
        h.user_id,
        h.kind,
        h.problem_summary,
        h.created_at,
        u.email as user_email
      FROM history h
      LEFT JOIN users u ON h.user_id = u.id
    `;

    const params = [];

    if (userId) {
      countQuery += ' WHERE user_id = ?';
      dataQuery += ' WHERE h.user_id = ?';
      params.push(userId);
    }

    dataQuery += ' ORDER BY h.created_at DESC LIMIT ? OFFSET ?';

    // Get total count
    const countStmt = userId
      ? env.DB.prepare(countQuery).bind(userId)
      : env.DB.prepare(countQuery);
    const countResult = await countStmt.first();
    const total = countResult?.count || 0;

    // Get history records
    const dataStmt = userId
      ? env.DB.prepare(dataQuery).bind(userId, limit, offset)
      : env.DB.prepare(dataQuery).bind(limit, offset);
    const history = await dataStmt.all();

    return jsonResponse({
      history: history.results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error('Error fetching history:', err);
    return errorResponse(500, '獲取歷史記錄失敗');
  }
}
