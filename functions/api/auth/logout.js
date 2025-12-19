/**
 * HKDSE Physics AI Tutor - Logout API
 * Clears the session and logs out the user
 */

import {
  getUserFromSession,
  createLogoutCookie,
  corsHeaders,
  jsonResponse,
} from '../../../shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromSession(request, env);

    if (user && user.sessionId) {
      // Delete the session from database
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?')
        .bind(user.sessionId)
        .run();
    }

    // Clear the session cookie
    const logoutCookie = createLogoutCookie();

    return jsonResponse(
      { success: true, message: '已登出' },
      200,
      { 'Set-Cookie': logoutCookie }
    );

  } catch (err) {
    console.error('Error in logout:', err);
    // Still clear cookie even if DB operation fails
    return jsonResponse(
      { success: true, message: '已登出' },
      200,
      { 'Set-Cookie': createLogoutCookie() }
    );
  }
}
