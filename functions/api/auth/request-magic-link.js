/**
 * HKDSE Physics AI Tutor - Request Magic Link API
 * Sends a magic link email for passwordless login
 */

import {
  generateId,
  generateToken,
  hashToken,
  isValidEmail,
  getExpiryTime,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from '../../../shared/auth.js';

const MAGIC_LINK_EXPIRY_MINUTES = 10;
const RATE_LIMIT_WINDOW_MINUTES = 5;
const RATE_LIMIT_MAX_REQUESTS = 3;

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || !isValidEmail(email)) {
      return errorResponse(400, '請輸入有效的電郵地址');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Get client IP for rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Check rate limit
    const rateLimitKey = `magic_link:${clientIP}:${normalizedEmail}`;
    const isRateLimited = await checkRateLimit(env.DB, rateLimitKey);

    if (isRateLimited) {
      return errorResponse(429, '請求過於頻繁，請稍後再試');
    }

    // Find or create user
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

    // Generate magic link token
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = getExpiryTime(MAGIC_LINK_EXPIRY_MINUTES);
    const linkId = generateId();

    // Store magic link
    await env.DB.prepare(`
      INSERT INTO magic_links (id, token_hash, user_id, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(linkId, tokenHash, user.id, expiresAt).run();

    // Build magic link URL
    const baseUrl = new URL(request.url).origin;
    const magicLink = `${baseUrl}/?magic_token=${token}`;

    // Send email via Resend
    const emailSent = await sendMagicLinkEmail(env.RESEND_API_KEY, normalizedEmail, magicLink);

    if (!emailSent) {
      return errorResponse(500, '發送電郵失敗，請稍後再試');
    }

    // Update rate limit
    await updateRateLimit(env.DB, rateLimitKey);

    return jsonResponse({
      success: true,
      message: '已發送登入連結到你的電郵，請查收',
    });

  } catch (err) {
    console.error('Error in request-magic-link:', err);
    return errorResponse(500, '處理失敗，請重試');
  }
}

async function checkRateLimit(db, key) {
  try {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - RATE_LIMIT_WINDOW_MINUTES);

    const record = await db.prepare(`
      SELECT count FROM rate_limits 
      WHERE key = ? AND window_start > ?
    `).bind(key, windowStart.toISOString()).first();

    return record && record.count >= RATE_LIMIT_MAX_REQUESTS;
  } catch (err) {
    console.error('Rate limit check error:', err);
    return false; // Fail open
  }
}

async function updateRateLimit(db, key) {
  try {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - RATE_LIMIT_WINDOW_MINUTES);

    // Try to increment existing record
    const result = await db.prepare(`
      UPDATE rate_limits 
      SET count = count + 1 
      WHERE key = ? AND window_start > ?
    `).bind(key, windowStart.toISOString()).run();

    if (result.meta.changes === 0) {
      // Create new record
      await db.prepare(`
        INSERT OR REPLACE INTO rate_limits (id, key, count, window_start)
        VALUES (?, ?, 1, datetime('now'))
      `).bind(generateId(), key).run();
    }
  } catch (err) {
    console.error('Rate limit update error:', err);
  }
}

async function sendMagicLinkEmail(apiKey, toEmail, magicLink) {
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'HKDSE Physics AI Tutor <onboarding@resend.dev>',
        to: [toEmail],
        subject: '登入 HKDSE Physics AI Tutor',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">🔬 HKDSE Physics AI Tutor</h1>
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              點擊下方按鈕登入你的帳戶：
            </p>
            <a href="${magicLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 20px;">
              登入帳戶
            </a>
            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              此連結將於 ${MAGIC_LINK_EXPIRY_MINUTES} 分鐘後過期，且只能使用一次。
            </p>
            <p style="font-size: 14px; color: #666;">
              如果你沒有請求此登入連結，請忽略此電郵。
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #999;">
              HKDSE Physics AI Tutor | 僅作學習輔助，不保證滿分
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', response.status, errorText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}
