/**
 * Complete Lesson API
 * POST /api/learn/lesson/complete
 * 
 * Finalizes a lesson session, awards XP, updates skill progress
 */

import { XP_CONFIG } from '../../../../shared/skillTreeConfig.js';
import { parseSessionCookie, hashToken } from '../../../../shared/auth.js';

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

// Calculate level from XP
function calculateLevel(totalXP) {
  const thresholds = XP_CONFIG.levelThresholds;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (totalXP >= thresholds[i]) {
      return i;
    }
  }
  return 0;
}

// Update user's daily progress
async function updateDailyProgress(db, userId, xpEarned) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Upsert daily progress
  await db.prepare(`
    INSERT INTO user_daily_progress (user_id, date, xp_earned, lessons_completed, goal_xp)
    VALUES (?, ?, ?, 1, 50)
    ON CONFLICT(user_id, date) DO UPDATE SET
      xp_earned = xp_earned + ?,
      lessons_completed = lessons_completed + 1,
      goal_met = CASE WHEN xp_earned + ? >= goal_xp THEN 1 ELSE goal_met END
  `).bind(userId, today, xpEarned, xpEarned, xpEarned).run();
  
  // Get updated daily progress
  return await db.prepare(
    'SELECT * FROM user_daily_progress WHERE user_id = ? AND date = ?'
  ).bind(userId, today).first();
}

// Update user's streak
async function updateStreak(db, userId) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  let streak = await db.prepare(
    'SELECT * FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first();
  
  if (!streak) {
    // Create new streak record
    await db.prepare(`
      INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date)
      VALUES (?, 1, 1, ?)
    `).bind(userId, today).run();
    return { currentStreak: 1, longestStreak: 1, extended: true };
  }
  
  // Check if streak continues, extends, or breaks
  if (streak.last_active_date === today) {
    // Already active today, no change
    return { 
      currentStreak: streak.current_streak, 
      longestStreak: streak.longest_streak, 
      extended: false 
    };
  } else if (streak.last_active_date === yesterday) {
    // Streak continues!
    const newStreak = streak.current_streak + 1;
    const newLongest = Math.max(newStreak, streak.longest_streak);
    
    await db.prepare(`
      UPDATE user_streaks 
      SET current_streak = ?, longest_streak = ?, last_active_date = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(newStreak, newLongest, today, Date.now(), userId).run();
    
    return { currentStreak: newStreak, longestStreak: newLongest, extended: true };
  } else {
    // Streak broken, start new one
    await db.prepare(`
      UPDATE user_streaks 
      SET current_streak = 1, last_active_date = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(today, Date.now(), userId).run();
    
    return { 
      currentStreak: 1, 
      longestStreak: streak.longest_streak, 
      extended: true, 
      streakBroken: true 
    };
  }
}

// Check for newly earned achievements
async function checkAchievements(db, userId, stats) {
  const newAchievements = [];
  
  // Get user's current achievements
  const existingAchievements = await db.prepare(
    'SELECT achievement_id FROM user_achievements WHERE user_id = ?'
  ).bind(userId).all();
  
  const existingIds = new Set((existingAchievements.results || []).map(a => a.achievement_id));
  
  // Get all achievements
  const allAchievements = await db.prepare('SELECT * FROM achievements').all();
  
  for (const achievement of allAchievements.results || []) {
    if (existingIds.has(achievement.id)) continue;
    
    let earned = false;
    
    switch (achievement.criteria_type) {
      case 'lessons':
        earned = stats.totalLessons >= achievement.criteria_value;
        break;
      case 'streak':
        earned = stats.streak >= achievement.criteria_value;
        break;
      case 'perfect':
        earned = stats.perfectLessons >= achievement.criteria_value;
        break;
      case 'xp':
        earned = stats.totalXP >= achievement.criteria_value;
        break;
    }
    
    if (earned) {
      await db.prepare(`
        INSERT INTO user_achievements (user_id, achievement_id, earned_at)
        VALUES (?, ?, ?)
      `).bind(userId, achievement.id, Date.now()).run();
      
      newAchievements.push({
        id: achievement.id,
        name: achievement.name,
        name_zh: achievement.name_zh,
        description: achievement.description,
        badgeIcon: achievement.badge_icon,
        xpReward: achievement.xp_reward,
      });
    }
  }
  
  return newAchievements;
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { sessionId } = body;
    
    if (!sessionId) {
      return Response.json({ error: 'sessionId is required' }, { status: 400 });
    }
    
    // Get lesson session
    const session = await env.DB.prepare(
      'SELECT * FROM lesson_sessions WHERE id = ? AND user_id = ?'
    ).bind(sessionId, user.id).first();
    
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }
    
    if (session.status === 'completed') {
      return Response.json({ error: 'Lesson already completed' }, { status: 400 });
    }
    
    // Calculate final XP
    const isPerfect = session.hearts_lost === 0 && session.questions_correct === session.questions_total;
    const completionBonus = XP_CONFIG.lessonComplete;
    const perfectBonus = isPerfect ? XP_CONFIG.perfectLesson : 0;
    const totalXP = session.xp_earned + completionBonus + perfectBonus;
    
    // Mark session as completed
    await env.DB.prepare(`
      UPDATE lesson_sessions 
      SET status = 'completed', completed_at = ?, xp_earned = ?, xp_bonus = ?, is_perfect = ?
      WHERE id = ?
    `).bind(Date.now(), totalXP, perfectBonus, isPerfect ? 1 : 0, sessionId).run();
    
    // Update skill progress
    const skillProgress = await env.DB.prepare(
      'SELECT * FROM user_skill_progress WHERE user_id = ? AND skill_node_id = ?'
    ).bind(user.id, session.skill_node_id).first();
    
    let newLevel = 0;
    let levelUp = false;
    
    if (skillProgress) {
      const newXP = skillProgress.xp_earned + totalXP;
      newLevel = calculateLevel(newXP);
      levelUp = newLevel > skillProgress.current_level;
      
      // Calculate next review time (spaced repetition)
      const hoursUntilReview = Math.pow(2, newLevel) * 24; // 24h, 48h, 96h, etc.
      const nextReviewAt = Date.now() + hoursUntilReview * 60 * 60 * 1000;
      
      await env.DB.prepare(`
        UPDATE user_skill_progress 
        SET xp_earned = ?, 
            current_level = ?,
            lessons_completed = lessons_completed + 1,
            perfect_lessons = perfect_lessons + ?,
            strength = CASE WHEN ? THEN 1.0 ELSE MIN(1.0, strength + 0.1) END,
            last_practiced_at = ?,
            next_review_at = ?
        WHERE user_id = ? AND skill_node_id = ?
      `).bind(
        newXP, 
        newLevel, 
        isPerfect ? 1 : 0,
        isPerfect,
        Date.now(),
        nextReviewAt,
        user.id, 
        session.skill_node_id
      ).run();
    } else {
      // Create new progress record
      newLevel = calculateLevel(totalXP);
      await env.DB.prepare(`
        INSERT INTO user_skill_progress 
        (user_id, skill_node_id, current_level, xp_earned, lessons_completed, perfect_lessons, last_practiced_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).bind(user.id, session.skill_node_id, newLevel, totalXP, isPerfect ? 1 : 0, Date.now()).run();
      levelUp = newLevel > 0;
    }
    
    // Update daily progress
    const dailyProgress = await updateDailyProgress(env.DB, user.id, totalXP);
    
    // Update streak
    const streakResult = await updateStreak(env.DB, user.id);
    
    // Get total stats for achievement check
    const totalStats = await env.DB.prepare(`
      SELECT 
        COALESCE(SUM(xp_earned), 0) as totalXP,
        COALESCE(SUM(lessons_completed), 0) as totalLessons,
        COALESCE(SUM(perfect_lessons), 0) as perfectLessons
      FROM user_skill_progress WHERE user_id = ?
    `).bind(user.id).first();
    
    // Check achievements
    const newAchievements = await checkAchievements(env.DB, user.id, {
      ...totalStats,
      streak: streakResult.currentStreak,
    });
    
    // Award achievement XP
    let achievementXP = 0;
    for (const achievement of newAchievements) {
      achievementXP += achievement.xpReward || 0;
    }
    
    if (achievementXP > 0) {
      await env.DB.prepare(`
        UPDATE user_skill_progress SET xp_earned = xp_earned + ? WHERE user_id = ? AND skill_node_id = ?
      `).bind(achievementXP, user.id, session.skill_node_id).run();
    }
    
    return Response.json({
      success: true,
      sessionId,
      
      // Lesson results
      results: {
        questionsAnswered: session.questions_answered,
        questionsCorrect: session.questions_correct,
        questionsTotal: session.questions_total,
        accuracy: Math.round((session.questions_correct / session.questions_total) * 100),
        heartsLost: session.hearts_lost,
        isPerfect,
      },
      
      // XP earned
      xp: {
        fromAnswers: session.xp_earned,
        completionBonus,
        perfectBonus,
        achievementBonus: achievementXP,
        total: totalXP + achievementXP,
      },
      
      // Skill progress
      skill: {
        nodeId: session.skill_node_id,
        currentLevel: newLevel,
        levelUp,
        xpToNextLevel: XP_CONFIG.levelThresholds[newLevel + 1] 
          ? XP_CONFIG.levelThresholds[newLevel + 1] - (skillProgress?.xp_earned || 0) - totalXP 
          : null,
      },
      
      // Streak
      streak: {
        current: streakResult.currentStreak,
        longest: streakResult.longestStreak,
        extended: streakResult.extended,
        broken: streakResult.streakBroken || false,
      },
      
      // Daily goal
      dailyGoal: {
        xpEarned: dailyProgress.xp_earned,
        goalXP: dailyProgress.goal_xp,
        goalMet: dailyProgress.goal_met === 1,
        lessonsToday: dailyProgress.lessons_completed,
      },
      
      // New achievements
      newAchievements,
    });
    
  } catch (err) {
    console.error('Complete lesson error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

