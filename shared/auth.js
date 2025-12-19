/**
 * HKDSE Physics AI Tutor - Shared Auth Utilities
 * For Cloudflare Pages Functions
 */

// Generate a random ID using Web Crypto API
export function generateId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a secure random token
export function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Hash a token using SHA-256
export async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sign data with HMAC-SHA256
export async function signData(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
}

// Verify HMAC signature
export async function verifySignature(data, signature, secret) {
  const expectedSignature = await signData(data, secret);
  return signature === expectedSignature;
}

// Parse session cookie
export function parseSessionCookie(cookieHeader, cookieName = 'session') {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split('=');
    if (name === cookieName) {
      return valueParts.join('=');
    }
  }
  return null;
}

// Create session cookie string
export function createSessionCookie(token, maxAge = 7 * 24 * 60 * 60) {
  // 7 days default
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

// Create logout cookie (expires immediately)
export function createLogoutCookie() {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

// Validate email format
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Get ISO datetime string for N minutes from now
export function getExpiryTime(minutes) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

// Check if a datetime string has expired
export function isExpired(isoString) {
  return new Date(isoString) < new Date();
}

// Get user from session (to be called in API handlers)
export async function getUserFromSession(request, env) {
  const cookieHeader = request.headers.get('Cookie');
  const sessionToken = parseSessionCookie(cookieHeader);

  if (!sessionToken) {
    return null;
  }

  try {
    const tokenHash = await hashToken(sessionToken);

    // Find session and user
    const result = await env.DB.prepare(`
      SELECT s.id as session_id, s.expires_at, u.id as user_id, u.email
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ?
    `).bind(tokenHash).first();

    if (!result) {
      return null;
    }

    // Check if session expired
    if (isExpired(result.expires_at)) {
      // Clean up expired session
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(result.session_id).run();
      return null;
    }

    return {
      id: result.user_id,
      email: result.email,
      sessionId: result.session_id,
    };
  } catch (err) {
    console.error('Error getting user from session:', err);
    return null;
  }
}

// Check if user is admin
export function isAdmin(email, env) {
  if (!email) return false;

  // Get admin emails from environment variable
  const adminEmails = env.ADMIN_EMAILS || '';
  const adminList = adminEmails.split(',').map(e => e.trim().toLowerCase());

  return adminList.includes(email.toLowerCase());
}

// CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

// Standard error response
export function errorResponse(status, message) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

// Standard success response
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        ...extraHeaders,
      },
    }
  );
}
