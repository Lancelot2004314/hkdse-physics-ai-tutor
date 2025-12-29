/**
 * User Avatar Upload API
 * POST - Upload avatar image to R2 and update user profile
 * DELETE - Remove avatar
 */

import {
  getUserFromSession,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from '../../../shared/auth.js';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max for avatar
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

// POST /api/user/avatar - Upload avatar
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Not authenticated');
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!file || !(file instanceof File)) {
      return errorResponse(400, 'No avatar file provided');
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse(400, 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(400, 'File too large. Maximum size: 2MB');
    }

    // Get file extension
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const filename = `avatars/${user.id}.${ext}`;

    // Delete old avatar if exists (different extension)
    const extensions = ['jpg', 'png', 'webp', 'gif'];
    for (const oldExt of extensions) {
      if (oldExt !== ext) {
        try {
          await env.R2_BUCKET.delete(`avatars/${user.id}.${oldExt}`);
        } catch (e) {
          // Ignore errors if file doesn't exist
        }
      }
    }

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await env.R2_BUCKET.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000', // 1 year cache
      },
    });

    // Generate public URL
    // R2 public URL format depends on your configuration
    // Using a relative path that will be served through the same domain
    const avatarUrl = `/api/user/avatar/${user.id}.${ext}`;

    // Update user profile with avatar URL
    const now = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE users
      SET avatar_url = ?, updated_at = ?
      WHERE id = ?
    `).bind(avatarUrl, now, user.id).run();

    return jsonResponse({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar_url: avatarUrl,
    });
  } catch (err) {
    console.error('Error uploading avatar:', err);
    return errorResponse(500, 'Failed to upload avatar');
  }
}

// DELETE /api/user/avatar - Remove avatar
export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Not authenticated');
    }

    // Get current avatar URL to find the file
    const profile = await env.DB.prepare(`
      SELECT avatar_url FROM users WHERE id = ?
    `).bind(user.id).first();

    if (profile?.avatar_url) {
      // Extract filename from URL
      const filename = profile.avatar_url.replace('/api/user/avatar/', 'avatars/');
      try {
        await env.R2_BUCKET.delete(filename);
      } catch (e) {
        console.error('Error deleting avatar from R2:', e);
      }
    }

    // Clear avatar URL in database
    const now = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE users
      SET avatar_url = NULL, updated_at = ?
      WHERE id = ?
    `).bind(now, user.id).run();

    return jsonResponse({
      success: true,
      message: 'Avatar removed successfully',
    });
  } catch (err) {
    console.error('Error removing avatar:', err);
    return errorResponse(500, 'Failed to remove avatar');
  }
}
