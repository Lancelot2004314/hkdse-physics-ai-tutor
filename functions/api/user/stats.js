/**
 * HKDSE Physics AI Tutor - User Stats API
 * Returns current user's practice statistics
 */

import { getUserFromSession } from '../../../shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // Get user
    const user = await getUserFromSession(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        loggedIn: false,
        stats: null,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    // Get user scores
    let stats = await env.DB.prepare(`
      SELECT 
        total_points,
        correct_count,
        total_attempts,
        current_streak,
        best_streak,
        last_practice_date
      FROM user_scores 
      WHERE user_id = ?
    `).bind(user.id).first();

    // Initialize if not exists
    if (!stats) {
      stats = {
        total_points: 0,
        correct_count: 0,
        total_attempts: 0,
        current_streak: 0,
        best_streak: 0,
        last_practice_date: null,
      };
    }

    // Calculate accuracy
    const accuracy = stats.total_attempts > 0 
      ? Math.round((stats.correct_count / stats.total_attempts) * 100) 
      : 0;

    // Get user's global rank
    const rankResult = await env.DB.prepare(`
      SELECT COUNT(*) + 1 as rank FROM user_scores WHERE total_points > ?
    `).bind(stats.total_points).first();

    // Get today's progress
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as attempts,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
        SUM(points_earned) as points
      FROM practice_history 
      WHERE user_id = ? AND date(created_at) = ?
    `).bind(user.id, today).first();

    // Get recent practice history
    const recentHistory = await env.DB.prepare(`
      SELECT 
        generated_question,
        user_answer,
        correct_answer,
        is_correct,
        points_earned,
        topic,
        created_at
      FROM practice_history 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(user.id).all();

    return new Response(JSON.stringify({
      loggedIn: true,
      stats: {
        totalPoints: stats.total_points,
        correctCount: stats.correct_count,
        totalAttempts: stats.total_attempts,
        accuracy,
        currentStreak: stats.current_streak,
        bestStreak: stats.best_streak,
        lastPracticeDate: stats.last_practice_date,
        globalRank: rankResult?.rank || 1,
      },
      today: {
        attempts: todayStats?.attempts || 0,
        correct: todayStats?.correct || 0,
        points: todayStats?.points || 0,
      },
      recentHistory: recentHistory.results.map(h => ({
        question: h.generated_question?.substring(0, 100) + '...',
        isCorrect: h.is_correct === 1,
        pointsEarned: h.points_earned,
        topic: h.topic,
        date: h.created_at,
      })),
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in user/stats:', err);
    return errorResponse(500, 'Failed to fetch stats');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
