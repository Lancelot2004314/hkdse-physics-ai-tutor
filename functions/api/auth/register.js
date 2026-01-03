/**
 * HKDSE Physics AI Tutor - Email Registration API
 * Register new user with email and password
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
} from '../../../shared/auth.js';

const SESSION_EXPIRY_DAYS = 7;
const MIN_PASSWORD_LENGTH = 6;

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { email, password, name } = body;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'register.js:entry', message: 'Register API called', data: { email, hasPassword: !!password, name }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => { });
        // #endregion

        // Validate email
        if (!email || !isValidEmail(email)) {
            return errorResponse(400, '请输入有效的邮箱地址', request);
        }

        // Validate password
        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            return errorResponse(400, `密码至少需要${MIN_PASSWORD_LENGTH}位`, request);
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if email already exists
        const existingUser = await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?')
            .bind(normalizedEmail)
            .first();

        if (existingUser) {
            // If user exists with password, they should login instead
            if (existingUser.password_hash) {
                return errorResponse(400, '该邮箱已注册，请直接登录', request);
            }
            // If user exists without password (e.g., Google OAuth user), allow setting password
            const passwordHash = await hashPassword(password);
            await env.DB.prepare('UPDATE users SET password_hash = ?, name = COALESCE(?, name) WHERE id = ?')
                .bind(passwordHash, name || null, existingUser.id)
                .run();

            // Create session for existing user
            return await createUserSession(env, existingUser.id, normalizedEmail, name, request);
        }

        // Create new user
        const userId = generateId();
        const passwordHash = await hashPassword(password);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'register.js:hash', message: 'Password hashed', data: { userId, hashLength: passwordHash.length, hashPreview: passwordHash.substring(0, 20) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2' }) }).catch(() => { });
        // #endregion

        await env.DB.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
            .bind(userId, normalizedEmail, passwordHash, name || null)
            .run();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'register.js:inserted', message: 'User inserted to DB', data: { userId, email: normalizedEmail }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => { });
        // #endregion

        // Create session
        return await createUserSession(env, userId, normalizedEmail, name, request);

    } catch (err) {
        console.error('Error in register:', err);
        return errorResponse(500, '注册失败，请重试', request);
    }
}

// Hash password using PBKDF2
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));

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

    // Combine salt and hash, encode as base64
    const combined = new Uint8Array(salt.length + hash.byteLength);
    combined.set(salt, 0);
    combined.set(new Uint8Array(hash), salt.length);

    return btoa(String.fromCharCode(...combined));
}

// Create session and return response
async function createUserSession(env, userId, email, name, request) {
    const sessionToken = generateToken();
    const sessionTokenHash = await hashToken(sessionToken);
    const sessionId = generateId();
    const sessionExpiresAt = getExpiryTime(SESSION_EXPIRY_DAYS * 24 * 60);

    await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionId, userId, sessionTokenHash, sessionExpiresAt).run();

    // Clean up old sessions for this user (keep only last 5)
    await env.DB.prepare(`
    DELETE FROM sessions 
    WHERE user_id = ? AND id NOT IN (
      SELECT id FROM sessions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    )
  `).bind(userId, userId).run();

    // Set session cookie
    const sessionCookie = createSessionCookie(sessionToken, SESSION_EXPIRY_DAYS * 24 * 60 * 60);

    return jsonResponse(
        {
            success: true,
            user: {
                id: userId,
                email: email,
                name: name || null,
            },
        },
        200,
        { 'Set-Cookie': sessionCookie },
        request
    );
}

