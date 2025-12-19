/**
 * HKDSE Physics AI Tutor - Admin Middleware
 * Protects all /api/admin/* routes
 * Requires: 1) Logged in user 2) Email in ADMIN_EMAILS whitelist
 */

import { getUserFromSession, errorResponse, corsHeaders } from '../../../shared/auth.js';

export async function onRequest(context) {
  const { request, env, next } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if ADMIN_EMAILS is configured
  const adminEmails = env.ADMIN_EMAILS;
  if (!adminEmails) {
    console.error('ADMIN_EMAILS not configured');
    return errorResponse(500, '管理員配置錯誤');
  }

  // Parse admin emails list
  const allowedEmails = adminEmails.split(',').map(e => e.trim().toLowerCase());

  // Get current user from session
  const user = await getUserFromSession(request, env);

  if (!user) {
    return errorResponse(401, '請先登入');
  }

  // Check if user email is in admin whitelist
  if (!allowedEmails.includes(user.email.toLowerCase())) {
    console.log(`Admin access denied for: ${user.email}`);
    return errorResponse(403, '無權限訪問管理面板');
  }

  // User is authenticated and authorized - attach user to context
  context.user = user;

  // Continue to the actual API handler
  return next();
}
