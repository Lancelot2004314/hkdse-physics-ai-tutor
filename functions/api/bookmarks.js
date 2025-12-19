/**
 * Bookmarks API
 * CRUD operations for bookmarked questions
 */

import { getUserFromSession } from '../../shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

// GET - List bookmarks
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const url = new URL(request.url);
    const topic = url.searchParams.get('topic');
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = ?';
    const params = [user.id];

    if (topic) {
      whereClause += ' AND topic = ?';
      params.push(topic);
    }

    if (type) {
      whereClause += ' AND question_type = ?';
      params.push(type);
    }

    // Get total count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM bookmarks ${whereClause}
    `).bind(...params).first();

    // Get bookmarks
    const bookmarks = await env.DB.prepare(`
      SELECT * FROM bookmarks ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    return new Response(JSON.stringify({
      bookmarks: bookmarks.results.map(b => ({
        id: b.id,
        sessionId: b.session_id,
        questionIndex: b.question_index,
        questionText: b.question_text,
        questionType: b.question_type,
        options: b.options ? JSON.parse(b.options) : null,
        correctAnswer: b.correct_answer,
        explanation: b.explanation,
        topic: b.topic,
        difficulty: b.difficulty,
        createdAt: b.created_at,
      })),
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit),
      },
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error getting bookmarks:', err);
    return errorResponse(500, 'Failed to fetch bookmarks');
  }
}

// POST - Add bookmark
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const body = await request.json();
    const {
      sessionId,
      questionIndex,
      questionText,
      questionType,
      options,
      correctAnswer,
      explanation,
      topic,
      difficulty,
    } = body;

    if (!questionText || !questionType) {
      return errorResponse(400, 'Question text and type are required');
    }

    const bookmarkId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO bookmarks (
        id, user_id, session_id, question_index, question_text,
        question_type, options, correct_answer, explanation, topic, difficulty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      bookmarkId,
      user.id,
      sessionId || null,
      questionIndex ?? null,
      questionText,
      questionType,
      options ? JSON.stringify(options) : null,
      correctAnswer || null,
      explanation || null,
      topic || null,
      difficulty || null
    ).run();

    return new Response(JSON.stringify({
      success: true,
      id: bookmarkId,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error adding bookmark:', err);
    return errorResponse(500, 'Failed to add bookmark');
  }
}

// DELETE - Remove bookmark
export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const url = new URL(request.url);
    const bookmarkId = url.searchParams.get('id');

    if (!bookmarkId) {
      return errorResponse(400, 'Bookmark ID is required');
    }

    const result = await env.DB.prepare(`
      DELETE FROM bookmarks WHERE id = ? AND user_id = ?
    `).bind(bookmarkId, user.id).run();

    return new Response(JSON.stringify({
      success: true,
      deleted: result.meta?.changes > 0,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error deleting bookmark:', err);
    return errorResponse(500, 'Failed to delete bookmark');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
