/**
 * HKDSE Physics AI Tutor - Google OAuth URL API
 * Returns the Google OAuth authorization URL
 */

import { corsHeaders, jsonResponse, errorResponse } from '../../../../shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('GOOGLE_CLIENT_ID not configured');
      return errorResponse(500, '服務配置錯誤');
    }

    // Get the origin for redirect URI - use login.html for OAuth callback
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/login.html`;

    // Build Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'email profile');
    googleAuthUrl.searchParams.set('access_type', 'online');
    googleAuthUrl.searchParams.set('prompt', 'select_account');

    return jsonResponse({
      url: googleAuthUrl.toString(),
    });

  } catch (err) {
    console.error('Error in google/url:', err);
    return errorResponse(500, '處理失敗');
  }
}
