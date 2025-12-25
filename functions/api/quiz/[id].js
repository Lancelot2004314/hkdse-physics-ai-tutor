/**
 * Quiz Session Detail API
 * Get details of a specific quiz session
 */

import { getUserFromSession } from '../../../shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const sessionId = params.id;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const session = await env.DB.prepare(`
      SELECT * FROM quiz_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, user.id).first();

    if (!session) {
      return errorResponse(404, 'Quiz session not found');
    }

    let questions = [];
    let answers = [];

    try {
      questions = JSON.parse(session.questions || '[]');
    } catch (e) {
      console.error('Error parsing questions:', e);
    }

    try {
      answers = JSON.parse(session.answers || '[]');
    } catch (e) {
      console.error('Error parsing answers:', e);
    }

    // For completed sessions, include answers and explanations
    let questionsWithAnswers = questions;
    if (session.status === 'completed') {
      questionsWithAnswers = questions.map((q, i) => ({
        ...q,
        userAnswer: i < answers.length ? answers[i] : null,
      }));
    } else {
      // For in-progress, hide correct answers
      questionsWithAnswers = questions.map(q => {
        const { correctAnswer, modelAnswer, markingScheme, ...safeQ } = q;
        return safeQ;
      });
    }

    // Get flagged questions
    const flagged = await env.DB.prepare(`
      SELECT question_index FROM flagged_questions WHERE session_id = ?
    `).bind(sessionId).all();
    const flaggedIndices = flagged.results.map(f => f.question_index);

    return new Response(JSON.stringify({
      id: session.id,
      topics: JSON.parse(session.topics || '[]'),
      difficulty: session.difficulty,
      timeLimit: session.time_limit,
      questions: questionsWithAnswers,
      answers: session.status === 'completed' ? answers : [],
      score: session.score,
      maxScore: session.max_score,
      grade: session.grade,
      timeSpent: session.time_spent,
      status: session.status,
      flaggedQuestions: flaggedIndices,
      createdAt: session.created_at,
      completedAt: session.completed_at,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in quiz/[id]:', err);
    return errorResponse(500, 'Failed to fetch quiz');
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const sessionId = params.id;

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    // Delete session and related flags
    await env.DB.prepare(`
      DELETE FROM flagged_questions WHERE session_id = ?
    `).bind(sessionId).run();

    const result = await env.DB.prepare(`
      DELETE FROM quiz_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, user.id).run();

    return new Response(JSON.stringify({
      success: true,
      deleted: result.meta?.changes > 0,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error deleting quiz:', err);
    return errorResponse(500, 'Failed to delete quiz');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}


