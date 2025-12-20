/**
 * HKDSE Physics AI Tutor - Google OAuth Callback API
 * Handles the OAuth callback, exchanges code for token, creates session
 */

import {
  generateId,
  generateToken,
  hashToken,
  getExpiryTime,
  createSessionCookie,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from '../../../../shared/auth.js';

const SESSION_EXPIRY_DAYS = 7;

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return errorResponse(400, '缺少授權碼');
    }

    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Google OAuth credentials not configured');
      return errorResponse(500, '服務配置錯誤');
    }

    // Get redirect URI (same as used in authorization) - must match url.js
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/login.html`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return errorResponse(400, '授權失敗，請重試');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No access token in response:', tokenData);
      return errorResponse(400, '授權失敗，請重試');
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info:', userInfoResponse.status);
      return errorResponse(400, '無法獲取用戶資訊');
    }

    const googleUser = await userInfoResponse.json();
    const { email, name, picture } = googleUser;

    if (!email) {
      return errorResponse(400, '無法獲取電郵地址');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find or create user in D1
    let user = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first();

    if (!user) {
      // Create new user
      const userId = generateId();
      await env.DB.prepare('INSERT INTO users (id, email) VALUES (?, ?)')
        .bind(userId, normalizedEmail)
        .run();
      user = { id: userId, email: normalizedEmail };
    }

    // Create session
    const sessionToken = generateToken();
    const sessionTokenHash = await hashToken(sessionToken);
    const sessionId = generateId();
    const sessionExpiresAt = getExpiryTime(SESSION_EXPIRY_DAYS * 24 * 60);

    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(sessionId, user.id, sessionTokenHash, sessionExpiresAt).run();

    // Clean up old sessions for this user (keep only last 5)
    await env.DB.prepare(`
      DELETE FROM sessions 
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM sessions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 5
      )
    `).bind(user.id, user.id).run();

    // Set session cookie
    const sessionCookie = createSessionCookie(sessionToken, SESSION_EXPIRY_DAYS * 24 * 60 * 60);

    return jsonResponse(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: name || null,
          picture: picture || null,
        },
      },
      200,
      { 'Set-Cookie': sessionCookie }
    );

  } catch (err) {
    console.error('Error in google/callback:', err);
    return errorResponse(500, '處理失敗，請重試');
  }
}
