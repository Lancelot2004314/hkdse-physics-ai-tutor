/**
 * HKDSE Physics AI Tutor - Get Current User API
 * Returns the current logged-in user's info
 */

import {
  getUserFromSession,
  parseSessionCookie,
  hashToken,
  getCorsHeaders,
  errorResponse,
  jsonResponse,
} from '../../../shared/auth.js';

export async function onRequestOptions(context) {
  const { request } = context;
  return new Response(null, { headers: getCorsHeaders(request) });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  // #region agent log - Debug info object
  const debug = {};
  // #endregion

  try {
    const cookieHeader = request.headers.get('Cookie');
    // #region agent log
    debug.hasCookie = !!cookieHeader;
    debug.cookiePreview = cookieHeader?.substring(0, 60);
    // #endregion

    const sessionToken = parseSessionCookie(cookieHeader);
    // #region agent log
    debug.hasSessionToken = !!sessionToken;
    debug.tokenPreview = sessionToken?.substring(0, 20);
    // #endregion

    if (!sessionToken) {
      // #region agent log
      debug.failReason = 'no_session_token';
      return jsonResponse({ user: null, debug }, 200, {}, request);
      // #endregion
    }

    const tokenHash = await hashToken(sessionToken);
    // #region agent log
    debug.tokenHashPreview = tokenHash?.substring(0, 20);
    // #endregion

    // Direct DB query for debugging
    const sessionResult = await env.DB.prepare(`
      SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ?
    `).bind(tokenHash).first();

    // #region agent log
    debug.sessionFound = !!sessionResult;
    debug.sessionUserId = sessionResult?.user_id;
    debug.sessionExpires = sessionResult?.expires_at;
    // #endregion

    if (!sessionResult) {
      // #region agent log
      debug.failReason = 'session_not_found_in_db';
      // Check how many sessions exist
      const countResult = await env.DB.prepare('SELECT COUNT(*) as cnt FROM sessions').first();
      debug.totalSessions = countResult?.cnt;
      return jsonResponse({ user: null, debug }, 200, {}, request);
      // #endregion
    }

    // Get user
    const userResult = await env.DB.prepare(`
      SELECT id, email, name, language, role, avatar_url FROM users WHERE id = ?
    `).bind(sessionResult.user_id).first();

    // #region agent log
    debug.userFound = !!userResult;
    debug.userEmail = userResult?.email;
    // #endregion

    if (!userResult) {
      // #region agent log
      debug.failReason = 'user_not_found';
      return jsonResponse({ user: null, debug }, 200, {}, request);
      // #endregion
    }

    // Filter out placeholder email for phone-only users
    const displayEmail = userResult.email && !userResult.email.endsWith('@phone.local') ? userResult.email : null;

    return jsonResponse({
      user: {
        id: userResult.id,
        email: displayEmail,
        name: userResult.name,
        language: userResult.language,
        role: userResult.role,
        avatar_url: userResult.avatar_url,
      },
      // #region agent log
      debug,
      // #endregion
    }, 200, {}, request);

  } catch (err) {
    console.error('Error in me:', err);
    // #region agent log
    debug.error = err.message;
    return jsonResponse({ user: null, debug }, 200, {}, request);
    // #endregion
  }
}
