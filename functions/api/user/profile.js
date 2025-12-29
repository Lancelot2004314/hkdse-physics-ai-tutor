/**
 * User Profile API
 * GET - Get user profile
 * POST - Update user profile
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

// GET /api/user/profile - Get current user's profile
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Not authenticated');
    }

    // Get full user profile from database
    const profile = await env.DB.prepare(`
      SELECT id, email, name, language, role, avatar_url, created_at, updated_at
      FROM users
      WHERE id = ?
    `).bind(user.id).first();

    if (!profile) {
      return errorResponse(404, 'User not found');
    }

    return jsonResponse({
      success: true,
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        language: profile.language || 'en',
        role: profile.role || 'student',
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (err) {
    console.error('Error getting profile:', err);
    return errorResponse(500, 'Failed to get profile');
  }
}

// POST /api/user/profile - Update user profile
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Not authenticated');
    }

    const body = await request.json();
    const { name, language, role } = body;

    // Validate inputs
    if (name !== undefined && typeof name !== 'string') {
      return errorResponse(400, 'Invalid name');
    }
    if (name && name.length > 100) {
      return errorResponse(400, 'Name too long (max 100 characters)');
    }

    const validLanguages = ['en', 'zh-HK', 'zh-CN'];
    if (language && !validLanguages.includes(language)) {
      return errorResponse(400, 'Invalid language. Must be: en, zh-HK, or zh-CN');
    }

    const validRoles = ['student', 'teacher', 'parent', 'other'];
    if (role && !validRoles.includes(role)) {
      return errorResponse(400, 'Invalid role. Must be: student, teacher, parent, or other');
    }

    // Update profile
    const now = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          language = COALESCE(?, language),
          role = COALESCE(?, role),
          updated_at = ?
      WHERE id = ?
    `).bind(
      name || null,
      language || null,
      role || null,
      now,
      user.id
    ).run();

    // Get updated profile
    const updatedProfile = await env.DB.prepare(`
      SELECT id, email, name, language, role, avatar_url, created_at, updated_at
      FROM users
      WHERE id = ?
    `).bind(user.id).first();

    return jsonResponse({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        name: updatedProfile.name,
        language: updatedProfile.language || 'en',
        role: updatedProfile.role || 'student',
        avatar_url: updatedProfile.avatar_url,
        created_at: updatedProfile.created_at,
        updated_at: updatedProfile.updated_at,
      },
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    return errorResponse(500, 'Failed to update profile');
  }
}
