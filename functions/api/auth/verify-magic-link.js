/**
 * HKDSE Physics AI Tutor - Verify Magic Link API
 * Verifies the magic link token and creates a session
 */

import {
  generateId,
  generateToken,
  hashToken,
  isExpired,
  getExpiryTime,
  createSessionCookie,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from '../../../shared/auth.js';

const SESSION_EXPIRY_DAYS = 7;

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return errorResponse(400, '缺少登入令牌');
    }

    // Hash the token to find it in database
    const tokenHash = await hashToken(token);

    // Find the magic link
    const magicLink = await env.DB.prepare(`
      SELECT ml.id, ml.user_id, ml.expires_at, ml.used_at, u.email
      FROM magic_links ml
      JOIN users u ON ml.user_id = u.id
      WHERE ml.token_hash = ?
    `).bind(tokenHash).first();

    if (!magicLink) {
      return errorResponse(400, '登入連結無效');
    }

    // Check if already used
    if (magicLink.used_at) {
      return errorResponse(400, '此登入連結已被使用');
    }

    // Check if expired
    if (isExpired(magicLink.expires_at)) {
      return errorResponse(400, '登入連結已過期，請重新請求');
    }

    // Mark magic link as used
    await env.DB.prepare(`
      UPDATE magic_links SET used_at = datetime('now') WHERE id = ?
    `).bind(magicLink.id).run();

    // Create session
    const sessionToken = generateToken();
    const sessionTokenHash = await hashToken(sessionToken);
    const sessionId = generateId();
    const sessionExpiresAt = getExpiryTime(SESSION_EXPIRY_DAYS * 24 * 60);

    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(sessionId, magicLink.user_id, sessionTokenHash, sessionExpiresAt).run();

    // Clean up old sessions for this user (keep only last 5)
    await env.DB.prepare(`
      DELETE FROM sessions 
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM sessions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 5
      )
    `).bind(magicLink.user_id, magicLink.user_id).run();

    // Clean up expired magic links (housekeeping)
    await env.DB.prepare(`
      DELETE FROM magic_links WHERE expires_at < datetime('now')
    `).run();

    // Set session cookie
    const sessionCookie = createSessionCookie(sessionToken, SESSION_EXPIRY_DAYS * 24 * 60 * 60);

    return jsonResponse(
      {
        success: true,
        user: {
          id: magicLink.user_id,
          email: magicLink.email,
        },
      },
      200,
      { 'Set-Cookie': sessionCookie }
    );

  } catch (err) {
    console.error('Error in verify-magic-link:', err);
    return errorResponse(500, '處理失敗，請重試');
  }
}
