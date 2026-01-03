/**
 * HKDSE Physics AI Tutor - Email Login API
 * Login with email and password
 */

import {
    generateId,
    generateToken,
    hashToken,
    getExpiryTime,
    isValidEmail,
    createSessionCookie,
    corsHeaders,
    getCorsHeaders,
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
        const { email, password } = body;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'login.js:entry', message: 'Login API called', data: { email, hasPassword: !!password }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H3' }) }).catch(() => { });
        // #endregion

        // Validate inputs
        if (!email || !isValidEmail(email)) {
            return errorResponse(400, '请输入有效的邮箱地址', request);
        }

        if (!password) {
            return errorResponse(400, '请输入密码', request);
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Find user
        const user = await env.DB.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?')
            .bind(normalizedEmail)
            .first();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'login.js:userFound', message: 'User lookup result', data: { found: !!user, hasPasswordHash: user?.password_hash?.length > 0, hashLength: user?.password_hash?.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H3' }) }).catch(() => { });
        // #endregion

        if (!user) {
            return errorResponse(400, '邮箱或密码错误', request);
        }

        if (!user.password_hash) {
            // User registered via Google OAuth, no password set
            return errorResponse(400, '此账号使用 Google 登录，请使用 Google 登录或设置密码', request);
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'login.js:verify', message: 'Password verification result', data: { isValid, storedHashLength: user.password_hash.length }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H4' }) }).catch(() => { });
        // #endregion

        if (!isValid) {
            return errorResponse(400, '邮箱或密码错误', request);
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
                    name: user.name || null,
                },
            },
            200,
            { 'Set-Cookie': sessionCookie },
            request
        );

    } catch (err) {
        console.error('Error in email/login:', err);
        return errorResponse(500, '登录失败，请重试', request);
    }
}

// Verify password using PBKDF2
async function verifyPassword(password, storedHash) {
    try {
        const encoder = new TextEncoder();

        // Decode stored hash (base64)
        const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));

        // Extract salt (first 16 bytes) and hash (remaining)
        const salt = combined.slice(0, 16);
        const storedHashBytes = combined.slice(16);

        // Hash the provided password with the same salt
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const hash = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            256
        );

        // Compare hashes
        const hashBytes = new Uint8Array(hash);
        if (hashBytes.length !== storedHashBytes.length) {
            return false;
        }

        for (let i = 0; i < hashBytes.length; i++) {
            if (hashBytes[i] !== storedHashBytes[i]) {
                return false;
            }
        }

        return true;
    } catch (err) {
        console.error('Password verification error:', err);
        return false;
    }
}

