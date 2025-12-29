/**
 * HKDSE Physics AI Tutor - Admin Text Questions API
 * Cloudflare Pages Function
 * Endpoints for listing, searching, and deleting text questions from D1 database
 */

import { getUserFromSession } from '../../../shared/auth.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  'Access-Control-Allow-Credentials': 'true',
};

// Admin emails (should match admin.js)
const ADMIN_EMAILS = [
  'lancelot20041011@gmail.com',
  'admin@hkdse-physics.com',
];

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

/**
 * GET /api/admin/text-questions
 * Query params: page (default 1), limit (default 20), search (optional)
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // Verify admin access
    const user = await getUserFromSession(request, env);
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      return errorResponse(403, 'Admin access required');
    }

    // Parse query params
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search')?.trim() || '';
    const offset = (page - 1) * limit;

    const db = env.DB;
    if (!db) {
      return errorResponse(500, 'Database not configured');
    }

    let questions, total;

    if (search) {
      // Search query
      const searchPattern = `%${search}%`;
      
      const countResult = await db.prepare(`
        SELECT COUNT(*) as count FROM text_questions
        WHERE question_text LIKE ?
      `).bind(searchPattern).first();
      total = countResult?.count || 0;

      const result = await db.prepare(`
        SELECT id, question_text, ai_answer, created_at
        FROM text_questions
        WHERE question_text LIKE ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).bind(searchPattern, limit, offset).all();
      questions = result.results || [];
    } else {
      // No search - list all
      const countResult = await db.prepare(`
        SELECT COUNT(*) as count FROM text_questions
      `).first();
      total = countResult?.count || 0;

      const result = await db.prepare(`
        SELECT id, question_text, ai_answer, created_at
        FROM text_questions
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset).all();
      questions = result.results || [];
    }

    // Parse AI answer JSON for each question
    const formattedQuestions = questions.map(q => {
      let parsedAnswer = null;
      try {
        parsedAnswer = JSON.parse(q.ai_answer);
      } catch (e) {
        parsedAnswer = { raw: q.ai_answer };
      }
      return {
        id: q.id,
        question_text: q.question_text,
        ai_answer: parsedAnswer,
        created_at: q.created_at,
      };
    });

    return new Response(JSON.stringify({
      questions: formattedQuestions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      search: search || null,
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (err) {
    console.error('Error in GET text-questions:', err);
    return errorResponse(500, 'Failed to fetch text questions');
  }
}

/**
 * DELETE /api/admin/text-questions?id=xxx
 */
export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    // Verify admin access
    const user = await getUserFromSession(request, env);
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      return errorResponse(403, 'Admin access required');
    }

    // Parse query params
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return errorResponse(400, 'Missing id parameter');
    }

    const db = env.DB;
    if (!db) {
      return errorResponse(500, 'Database not configured');
    }

    // Check if exists
    const existing = await db.prepare(`
      SELECT id FROM text_questions WHERE id = ?
    `).bind(id).first();

    if (!existing) {
      return errorResponse(404, 'Question not found');
    }

    // Delete
    await db.prepare(`
      DELETE FROM text_questions WHERE id = ?
    `).bind(id).run();

    console.log(`Deleted text question: ${id}`);

    return new Response(JSON.stringify({
      success: true,
      deleted: id,
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (err) {
    console.error('Error in DELETE text-questions:', err);
    return errorResponse(500, 'Failed to delete text question');
  }
}

function errorResponse(status, message) {
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

