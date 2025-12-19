/**
 * Quiz Submit API
 * Grades answers and saves results
 */

import { GRADE_SHORT_ANSWER_PROMPT } from '../../../shared/prompts.js';
import { calculateGrade } from '../../../shared/topics.js';
import { getUserFromSession } from '../../../shared/auth.js';
import { saveTokenUsage } from '../../../shared/tokenUsage.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { sessionId, answers, timeSpent } = body;

    if (!sessionId || !answers) {
      return errorResponse(400, 'Session ID and answers are required');
    }

    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    // Get session
    const session = await env.DB.prepare(`
      SELECT * FROM quiz_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, user.id).first();

    if (!session) {
      return errorResponse(404, 'Quiz session not found');
    }

    if (session.status === 'completed') {
      return errorResponse(400, 'Quiz already submitted');
    }

    const questions = JSON.parse(session.questions || '[]');
    const results = [];
    let totalScore = 0;
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Grade each answer
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const userAnswer = answers[i] || '';
      let score = 0;
      let feedback = '';
      let isCorrect = false;

      if (question.type === 'mc') {
        // Auto-grade MC
        isCorrect = userAnswer.toUpperCase() === question.correctAnswer?.toUpperCase();
        score = isCorrect ? (question.score || 1) : 0;
        feedback = isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${question.correctAnswer}.`;
      } else if (question.type === 'short' || question.type === 'long') {
        // AI-grade short/long answers
        if (userAnswer.trim()) {
          const gradeResult = await gradeShortAnswer(
            env.DEEPSEEK_API_KEY,
            userAnswer,
            question.modelAnswer || question.parts?.map(p => p.modelAnswer).join('\n'),
            question.markingScheme || question.parts?.map(p => `${p.marks} marks: ${p.question}`),
            question.score || question.parts?.reduce((s, p) => s + p.marks, 0) || 5
          );

          if (gradeResult.success) {
            score = gradeResult.score;
            feedback = gradeResult.feedback;
            if (gradeResult.usage) {
              totalUsage.prompt_tokens += gradeResult.usage.prompt_tokens || 0;
              totalUsage.completion_tokens += gradeResult.usage.completion_tokens || 0;
              totalUsage.total_tokens += gradeResult.usage.total_tokens || 0;
            }
          }
        }
        isCorrect = score >= (question.score || 5) * 0.5; // 50% threshold
      }

      totalScore += score;
      results.push({
        questionIndex: i,
        userAnswer,
        correctAnswer: question.correctAnswer || question.modelAnswer,
        score,
        maxScore: question.score || 1,
        isCorrect,
        feedback,
        explanation: question.explanation,
      });
    }

    // Calculate grade
    const percentage = session.max_score > 0 ? (totalScore / session.max_score) * 100 : 0;
    const grade = calculateGrade(percentage);

    // Update session
    await env.DB.prepare(`
      UPDATE quiz_sessions SET
        answers = ?,
        score = ?,
        grade = ?,
        time_spent = ?,
        status = 'completed',
        completed_at = datetime('now')
      WHERE id = ?
    `).bind(
      JSON.stringify(answers),
      totalScore,
      grade,
      timeSpent || 0,
      sessionId
    ).run();

    // Update user scores
    await updateUserScores(env.DB, user.id, totalScore, questions.length, percentage >= 50);

    // Track token usage
    if (totalUsage.total_tokens > 0) {
      await saveTokenUsage(env.DB, user.id, 'deepseek', totalUsage, 'quiz-grade');
    }

    return new Response(JSON.stringify({
      score: totalScore,
      maxScore: session.max_score,
      percentage: Math.round(percentage),
      grade,
      results,
      timeSpent,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in quiz/submit:', err);
    return errorResponse(500, 'Failed to submit quiz');
  }
}

async function gradeShortAnswer(apiKey, studentAnswer, modelAnswer, markingScheme, maxScore) {
  if (!apiKey) return { success: false, score: 0, feedback: 'Grading unavailable' };

  const prompt = GRADE_SHORT_ANSWER_PROMPT
    .replace('{studentAnswer}', studentAnswer)
    .replace('{modelAnswer}', modelAnswer || 'N/A')
    .replace('{markingScheme}', Array.isArray(markingScheme) ? markingScheme.join('\n') : markingScheme || 'N/A')
    .replace('{maxScore}', maxScore);

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an HKDSE Physics examiner. Grade fairly and provide constructive feedback.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      return { success: false, score: 0, feedback: 'Grading failed' };
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';

    // Parse grading result
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        score: Math.min(result.score || 0, maxScore),
        feedback: result.feedback || '',
        usage: data.usage,
      };
    }

    return { success: false, score: 0, feedback: 'Failed to parse grade' };
  } catch (err) {
    console.error('Grading error:', err);
    return { success: false, score: 0, feedback: 'Grading error' };
  }
}

async function updateUserScores(db, userId, points, questionsCount, isPass) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if user has scores record
    const existing = await db.prepare(`
      SELECT * FROM user_scores WHERE user_id = ?
    `).bind(userId).first();

    if (existing) {
      // Calculate streak
      let newStreak = existing.current_streak || 0;
      let bestStreak = existing.best_streak || 0;
      const lastPracticeDate = existing.last_practice_date;
      
      if (lastPracticeDate) {
        const lastDate = new Date(lastPracticeDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          // Same day - streak stays the same
        } else if (diffDays === 1) {
          // Consecutive day - increase streak
          newStreak += 1;
        } else {
          // Streak broken - reset to 1
          newStreak = 1;
        }
      } else {
        // First practice ever
        newStreak = 1;
      }
      
      // Update best streak if needed
      if (newStreak > bestStreak) {
        bestStreak = newStreak;
      }

      await db.prepare(`
        UPDATE user_scores SET
          total_points = total_points + ?,
          correct_count = correct_count + ?,
          total_attempts = total_attempts + ?,
          current_streak = ?,
          best_streak = ?,
          last_practice_date = ?,
          updated_at = datetime('now')
        WHERE user_id = ?
      `).bind(
        points,
        isPass ? 1 : 0,
        1, // Increment by 1 practice session, not by question count
        newStreak,
        bestStreak,
        today,
        userId
      ).run();
    } else {
      // New user - create record with streak = 1
      await db.prepare(`
        INSERT INTO user_scores (
          user_id, total_points, correct_count, total_attempts,
          current_streak, best_streak, last_practice_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        points,
        isPass ? 1 : 0,
        1, // First practice session
        1, // First day streak
        1, // Best streak starts at 1
        today
      ).run();
    }
  } catch (err) {
    console.error('Failed to update user scores:', err);
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
