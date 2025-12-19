/**
 * HKDSE Physics AI Tutor - Admin History Item API
 * Get or delete a single history record
 */

import { jsonResponse, errorResponse, corsHeaders } from '../../../../shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const historyId = params.id;

  if (!historyId) {
    return errorResponse(400, '缺少記錄 ID');
  }

  try {
    const record = await env.DB.prepare(`
      SELECT 
        h.*,
        u.email as user_email
      FROM history h
      LEFT JOIN users u ON h.user_id = u.id
      WHERE h.id = ?
    `).bind(historyId).first();

    if (!record) {
      return errorResponse(404, '記錄不存在');
    }

    // Parse JSON fields
    let request_data = null;
    let response_data = null;
    
    try {
      request_data = JSON.parse(record.request_json);
    } catch (e) {}
    
    try {
      response_data = JSON.parse(record.response_json);
    } catch (e) {}

    return jsonResponse({
      history: {
        ...record,
        request_data,
        response_data
      }
    });

  } catch (err) {
    console.error('Error fetching history record:', err);
    return errorResponse(500, '獲取記錄失敗');
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const historyId = params.id;

  if (!historyId) {
    return errorResponse(400, '缺少記錄 ID');
  }

  try {
    // Check if record exists
    const record = await env.DB.prepare('SELECT id FROM history WHERE id = ?').bind(historyId).first();
    
    if (!record) {
      return errorResponse(404, '記錄不存在');
    }

    // Delete the record
    await env.DB.prepare('DELETE FROM history WHERE id = ?').bind(historyId).run();

    return jsonResponse({
      success: true,
      message: '記錄已刪除'
    });

  } catch (err) {
    console.error('Error deleting history record:', err);
    return errorResponse(500, '刪除記錄失敗');
  }
}
