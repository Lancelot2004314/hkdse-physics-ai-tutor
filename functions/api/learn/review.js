/**
 * Spaced Repetition Review API
 * GET /api/learn/review - Get skills that need review
 * POST /api/learn/review - Start a review session
 * 
 * Uses SM-2 inspired algorithm for spaced repetition
 */

import { parseSessionCookie, hashToken } from '../../../shared/auth.js';

// Helper to get user from session
async function getUser(request, env) {
  const cookieHeader = request.headers.get('Cookie');
  const sessionToken = parseSessionCookie(cookieHeader);
  if (!sessionToken) return null;
  
  const tokenHash = await hashToken(sessionToken);
  const session = await env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token_hash = ?'
  ).bind(tokenHash).first();
  
  if (!session) return null;
  
  return await env.DB.prepare(
    'SELECT id, email, name as display_name FROM users WHERE id = ?'
  ).bind(session.user_id).first();
}

// Calculate next review interval based on performance
// Uses a simplified SM-2 algorithm
function calculateNextReview(currentStrength, isCorrect, currentLevel) {
  // Base interval in hours
  // Level 1: 24h, Level 2: 48h, Level 3: 96h, Level 4: 192h, Level 5: 384h
  const baseInterval = Math.pow(2, currentLevel) * 24;
  
  let newStrength = currentStrength;
  let intervalMultiplier = 1;
  
  if (isCorrect) {
    // Correct answer: increase strength, longer interval
    newStrength = Math.min(1.0, currentStrength + 0.1);
    intervalMultiplier = 1.0 + (currentStrength * 0.5);
  } else {
    // Wrong answer: decrease strength, shorter interval
    newStrength = Math.max(0.2, currentStrength - 0.2);
    intervalMultiplier = 0.5;
  }
  
  const intervalHours = Math.round(baseInterval * intervalMultiplier);
  const nextReviewAt = Date.now() + intervalHours * 60 * 60 * 1000;
  
  return {
    newStrength,
    nextReviewAt,
    intervalHours,
  };
}

// Decay strength over time for skills not practiced
function calculateStrengthDecay(lastPracticedAt, currentStrength) {
  if (!lastPracticedAt) return currentStrength;
  
  const daysSinceLastPractice = (Date.now() - lastPracticedAt) / (24 * 60 * 60 * 1000);
  
  // Decay rate: lose 5% strength per day after 3 days of inactivity
  if (daysSinceLastPractice > 3) {
    const daysOfDecay = daysSinceLastPractice - 3;
    const decayAmount = daysOfDecay * 0.05;
    return Math.max(0.2, currentStrength - decayAmount);
  }
  
  return currentStrength;
}

// GET - Get skills that need review
export async function onRequestGet({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const now = Date.now();
    
    // Get all skills that need review (next_review_at < now or strength < 0.5)
    const results = await env.DB.prepare(`
      SELECT 
        sp.skill_node_id,
        sp.current_level,
        sp.xp_earned,
        sp.lessons_completed,
        sp.strength,
        sp.last_practiced_at,
        sp.next_review_at
      FROM user_skill_progress sp
      WHERE sp.user_id = ?
        AND sp.current_level > 0
        AND (sp.next_review_at < ? OR sp.strength < 0.5)
      ORDER BY 
        CASE WHEN sp.strength < 0.5 THEN 0 ELSE 1 END,
        sp.next_review_at ASC
      LIMIT 10
    `).bind(user.id, now).all();
    
    const skillsToReview = (results.results || []).map(row => {
      const decayedStrength = calculateStrengthDecay(row.last_practiced_at, row.strength);
      const urgency = row.next_review_at < now ? 'overdue' : (decayedStrength < 0.5 ? 'weakening' : 'due');
      
      return {
        skillNodeId: row.skill_node_id,
        currentLevel: row.current_level,
        strength: decayedStrength,
        originalStrength: row.strength,
        lessonsCompleted: row.lessons_completed,
        lastPracticedAt: row.last_practiced_at,
        nextReviewAt: row.next_review_at,
        urgency,
        daysSinceLastPractice: row.last_practiced_at 
          ? Math.floor((now - row.last_practiced_at) / (24 * 60 * 60 * 1000))
          : null,
      };
    });
    
    // Update decayed strength in database
    for (const skill of skillsToReview) {
      if (skill.strength !== skill.originalStrength) {
        await env.DB.prepare(`
          UPDATE user_skill_progress SET strength = ? WHERE user_id = ? AND skill_node_id = ?
        `).bind(skill.strength, user.id, skill.skillNodeId).run();
      }
    }
    
    // Get total count of skills needing review
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM user_skill_progress
      WHERE user_id = ? AND current_level > 0 AND (next_review_at < ? OR strength < 0.5)
    `).bind(user.id, now).first();
    
    return Response.json({
      success: true,
      totalNeedingReview: countResult?.count || 0,
      skillsToReview,
      reviewTip: skillsToReview.length > 0 
        ? 'Review these skills to maintain your knowledge!' 
        : 'All skills are fresh! Great job!',
    });
    
  } catch (err) {
    console.error('Review GET error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST - Start a review session (redirects to lesson with review type)
export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { skillNodeId, reviewAll = false } = body;
    
    if (!skillNodeId && !reviewAll) {
      return Response.json({ error: 'skillNodeId or reviewAll required' }, { status: 400 });
    }
    
    if (reviewAll) {
      // Get the most urgent skill to review
      const now = Date.now();
      const result = await env.DB.prepare(`
        SELECT skill_node_id FROM user_skill_progress
        WHERE user_id = ? AND current_level > 0 AND (next_review_at < ? OR strength < 0.5)
        ORDER BY strength ASC, next_review_at ASC
        LIMIT 1
      `).bind(user.id, now).first();
      
      if (!result) {
        return Response.json({
          success: false,
          message: 'No skills need review',
        });
      }
      
      return Response.json({
        success: true,
        skillNodeId: result.skill_node_id,
        lessonType: 'review',
        redirectUrl: `/lesson.html?skill=${result.skill_node_id}&type=review`,
      });
    }
    
    // Verify skill needs review
    const skillProgress = await env.DB.prepare(
      'SELECT * FROM user_skill_progress WHERE user_id = ? AND skill_node_id = ?'
    ).bind(user.id, skillNodeId).first();
    
    if (!skillProgress || skillProgress.current_level === 0) {
      return Response.json({ error: 'Skill not unlocked' }, { status: 400 });
    }
    
    return Response.json({
      success: true,
      skillNodeId,
      lessonType: 'review',
      redirectUrl: `/lesson.html?skill=${skillNodeId}&type=review`,
    });
    
  } catch (err) {
    console.error('Review POST error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// Export helper for use in other modules
export { calculateNextReview, calculateStrengthDecay };

