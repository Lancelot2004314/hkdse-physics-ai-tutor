/**
 * HKDSE Physics AI Tutor - Save History API
 * Saves a solved problem to user's history
 */

import {
  generateId,
  getUserFromSession,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from '../../../shared/auth.js';

const MAX_HISTORY_PER_USER = 100;

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Check authentication
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, '請先登入');
    }

    const body = await request.json();
    const { kind, problemSummary, requestData, responseData } = body;

    // Validate
    if (!kind || !['image', 'text'].includes(kind)) {
      return errorResponse(400, '無效的題目類型');
    }
    if (!requestData || !responseData) {
      return errorResponse(400, '缺少題目或回答資料');
    }

    // Create history entry
    const historyId = generateId();
    const requestJson = JSON.stringify(requestData);
    const responseJson = JSON.stringify(responseData);

    await env.DB.prepare(`
      INSERT INTO history (id, user_id, kind, problem_summary, request_json, response_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      historyId,
      user.id,
      kind,
      problemSummary || '',
      requestJson,
      responseJson
    ).run();

    // Clean up old history (keep only last MAX_HISTORY_PER_USER)
    await env.DB.prepare(`
      DELETE FROM history 
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM history 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      )
    `).bind(user.id, user.id, MAX_HISTORY_PER_USER).run();

    return jsonResponse({
      success: true,
      historyId,
    });

  } catch (err) {
    console.error('Error in history/save:', err);
    return errorResponse(500, '儲存失敗，請重試');
  }
}
