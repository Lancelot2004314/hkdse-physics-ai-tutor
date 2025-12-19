/**
 * HKDSE Physics AI Tutor - Practice Answer Submission
 * Validates answers and calculates points with streak bonuses
 */

import { getUserFromSession } from '../../../shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Points configuration
const POINTS = {
  CORRECT: 10,
  STREAK_BONUS_3: 5,  // Bonus per question at 3+ streak
  STREAK_BONUS_7: 10, // Bonus per question at 7+ streak
  FIRST_OF_DAY: 5,
  PERFECT_WEEK: 50,
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { practiceId, userAnswer } = body;

    if (!practiceId || !userAnswer) {
      return errorResponse(400, 'Practice ID and answer are required');
    }

    // Get user
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login to submit answers');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    // Get the practice question
    const practice = await env.DB.prepare(`
      SELECT * FROM practice_history WHERE id = ? AND user_id = ?
    `).bind(practiceId, user.id).first();

    if (!practice) {
      return errorResponse(404, 'Practice question not found');
    }

    if (practice.user_answer) {
      return errorResponse(400, 'This question has already been answered');
    }

    // Check if answer is correct (case-insensitive comparison)
    const isCorrect = userAnswer.trim().toLowerCase() === practice.correct_answer.trim().toLowerCase();

    // Get current user scores
    let userScores = await env.DB.prepare(`
      SELECT * FROM user_scores WHERE user_id = ?
    `).bind(user.id).first();

    // Initialize scores if not exist
    if (!userScores) {
      await env.DB.prepare(`
        INSERT INTO user_scores (user_id, total_points, correct_count, total_attempts, current_streak, best_streak, last_practice_date)
        VALUES (?, 0, 0, 0, 0, 0, NULL)
      `).bind(user.id).run();
      
      userScores = {
        total_points: 0,
        correct_count: 0,
        total_attempts: 0,
        current_streak: 0,
        best_streak: 0,
        last_practice_date: null,
      };
    }

    // Calculate points
    let pointsEarned = 0;
    let newStreak = userScores.current_streak;
    const today = new Date().toISOString().split('T')[0];
    const isFirstOfDay = userScores.last_practice_date !== today;

    if (isCorrect) {
      // Base points
      pointsEarned = POINTS.CORRECT;

      // Streak bonus
      newStreak = userScores.current_streak + 1;
      if (newStreak >= 7) {
        pointsEarned += POINTS.STREAK_BONUS_7;
      } else if (newStreak >= 3) {
        pointsEarned += POINTS.STREAK_BONUS_3;
      }

      // First question of day bonus
      if (isFirstOfDay) {
        pointsEarned += POINTS.FIRST_OF_DAY;
      }
    } else {
      // Reset streak on wrong answer
      newStreak = 0;
    }

    // Update best streak
    const newBestStreak = Math.max(userScores.best_streak, newStreak);

    // Update user scores
    await env.DB.prepare(`
      UPDATE user_scores SET
        total_points = total_points + ?,
        correct_count = correct_count + ?,
        total_attempts = total_attempts + 1,
        current_streak = ?,
        best_streak = ?,
        last_practice_date = ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `).bind(
      pointsEarned,
      isCorrect ? 1 : 0,
      newStreak,
      newBestStreak,
      today,
      user.id
    ).run();

    // Update practice history
    await env.DB.prepare(`
      UPDATE practice_history SET
        user_answer = ?,
        is_correct = ?,
        points_earned = ?
      WHERE id = ?
    `).bind(userAnswer, isCorrect ? 1 : 0, pointsEarned, practiceId).run();

    // Get updated totals
    const updatedScores = await env.DB.prepare(`
      SELECT total_points, current_streak, correct_count, total_attempts FROM user_scores WHERE user_id = ?
    `).bind(user.id).first();

    return new Response(JSON.stringify({
      isCorrect,
      correctAnswer: practice.correct_answer,
      pointsEarned,
      newStreak,
      totalPoints: updatedScores.total_points,
      totalCorrect: updatedScores.correct_count,
      totalAttempts: updatedScores.total_attempts,
      streakBonus: newStreak >= 7 ? POINTS.STREAK_BONUS_7 : (newStreak >= 3 ? POINTS.STREAK_BONUS_3 : 0),
      isFirstOfDay,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in practice/submit:', err);
    return errorResponse(500, 'Failed to submit answer');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
