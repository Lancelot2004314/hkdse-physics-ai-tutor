/**
 * HKDSE Physics AI Tutor - Get History Item API
 * Returns a specific history item with full data
 */

import {
  getUserFromSession,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from '../../../shared/auth.js';

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

    // Get history ID from query parameter
    const url = new URL(request.url);
    const historyId = url.searchParams.get('id');

    if (!historyId) {
      return errorResponse(400, '缺少歷史記錄 ID');
    }

    // Get history item (verify it belongs to user)
    const item = await env.DB.prepare(`
      SELECT id, kind, problem_summary, request_json, response_json, created_at
      FROM history
      WHERE id = ? AND user_id = ?
    `).bind(historyId, user.id).first();

    if (!item) {
      return errorResponse(404, '找不到該歷史記錄');
    }

    // Parse JSON fields
    let requestData, responseData;
    try {
      requestData = JSON.parse(item.request_json);
      responseData = JSON.parse(item.response_json);
    } catch (e) {
      console.error('Error parsing history JSON:', e);
      return errorResponse(500, '資料格式錯誤');
    }

    return jsonResponse({
      id: item.id,
      kind: item.kind,
      problemSummary: item.problem_summary,
      requestData,
      responseData,
      createdAt: item.created_at,
    });

  } catch (err) {
    console.error('Error in history/get:', err);
    return errorResponse(500, '載入失敗，請重試');
  }
}
