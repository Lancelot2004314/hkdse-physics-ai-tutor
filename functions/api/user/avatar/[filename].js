/**
 * Serve Avatar Images from R2
 * GET /api/user/avatar/:filename
 */

export async function onRequestGet(context) {
  const { params, env } = context;
  const { filename } = params;

  try {
    // Get avatar from R2
    const key = `avatars/${filename}`;
    const object = await env.R2_BUCKET.get(key);

    if (!object) {
      return new Response('Avatar not found', { status: 404 });
    }

    // Determine content type from extension
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
    };
    const contentType = contentTypes[ext] || 'image/jpeg';

    // Return the image with proper headers
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Error serving avatar:', err);
    return new Response('Error serving avatar', { status: 500 });
  }
}

