/**
 * HKDSE Physics AI Tutor - Admin Delete User API
 * Delete a user and all their data
 */

import { jsonResponse, errorResponse, corsHeaders } from '../../../../shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const userId = params.id;

  if (!userId) {
    return errorResponse(400, '缺少用戶 ID');
  }

  try {
    // Check if user exists
    const user = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(userId).first();
    
    if (!user) {
      return errorResponse(404, '用戶不存在');
    }

    // Don't allow deleting yourself
    if (context.user && context.user.id === userId) {
      return errorResponse(400, '不能刪除自己的帳戶');
    }

    // Delete user (CASCADE will handle sessions, history)
    // But we need to handle token_usage separately since it uses SET NULL
    await env.DB.prepare('DELETE FROM token_usage WHERE user_id = ?').bind(userId).run();
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

    return jsonResponse({
      success: true,
      message: `已刪除用戶 ${user.email}`
    });

  } catch (err) {
    console.error('Error deleting user:', err);
    return errorResponse(500, '刪除用戶失敗');
  }
}

// Get single user details
export async function onRequestGet(context) {
  const { env, params } = context;
  const userId = params.id;

  if (!userId) {
    return errorResponse(400, '缺少用戶 ID');
  }

  try {
    const user = await env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        (SELECT COUNT(*) FROM history WHERE user_id = u.id) as history_count,
        (SELECT SUM(total_tokens) FROM token_usage WHERE user_id = u.id) as total_tokens
      FROM users u
      WHERE u.id = ?
    `).bind(userId).first();

    if (!user) {
      return errorResponse(404, '用戶不存在');
    }

    return jsonResponse({ user });

  } catch (err) {
    console.error('Error fetching user:', err);
    return errorResponse(500, '獲取用戶信息失敗');
  }
}
