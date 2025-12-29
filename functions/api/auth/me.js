/**
 * HKDSE Physics AI Tutor - Get Current User API
 * Returns the current logged-in user's info
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
    const user = await getUserFromSession(request, env);

    if (!user) {
      return jsonResponse({ user: null });
    }

    return jsonResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        language: user.language,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });

  } catch (err) {
    console.error('Error in me:', err);
    return errorResponse(500, '處理失敗，請重試');
  }
}
