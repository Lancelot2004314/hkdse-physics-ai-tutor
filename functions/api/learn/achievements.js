/**
 * Achievements API
 * GET /api/learn/achievements - Get all achievements with user progress
 */

import { ACHIEVEMENTS } from '../../../shared/skillTreeConfig.js';
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

// Get user stats for achievement checking
async function getUserStats(db, userId) {
  // Get total lessons and perfect lessons
  const lessonStats = await db.prepare(`
    SELECT 
      COALESCE(SUM(lessons_completed), 0) as totalLessons,
      COALESCE(SUM(perfect_lessons), 0) as perfectLessons,
      COALESCE(SUM(xp_earned), 0) as totalXP
    FROM user_skill_progress WHERE user_id = ?
  `).bind(userId).first();
  
  // Get streak
  const streakData = await db.prepare(
    'SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first();
  
  // Get completed units (all skills in unit at level >= 5)
  const unitCompletion = await db.prepare(`
    SELECT skill_node_id, current_level FROM user_skill_progress WHERE user_id = ?
  `).bind(userId).all();
  
  const completedUnits = new Set();
  const unitSkillCounts = {
    1: { needed: 4, completed: 0 }, // Heat and Gases
    2: { needed: 7, completed: 0 }, // Force and Motion
    3: { needed: 3, completed: 0 }, // Wave Motion
    4: { needed: 3, completed: 0 }, // E&M
    5: { needed: 3, completed: 0 }, // Nuclear
  };
  
  for (const row of unitCompletion.results || []) {
    if (row.current_level >= 5) {
      const unitNum = parseInt(row.skill_node_id.split('-')[1]?.[0] || '0');
      if (unitSkillCounts[unitNum]) {
        unitSkillCounts[unitNum].completed++;
        if (unitSkillCounts[unitNum].completed >= unitSkillCounts[unitNum].needed) {
          completedUnits.add(unitNum);
        }
      }
    }
  }
  
  return {
    totalLessons: lessonStats?.totalLessons || 0,
    perfectLessons: lessonStats?.perfectLessons || 0,
    totalXP: lessonStats?.totalXP || 0,
    currentStreak: streakData?.current_streak || 0,
    longestStreak: streakData?.longest_streak || 0,
    completedUnits: Array.from(completedUnits),
  };
}

// Check if achievement is earned
function isAchievementEarned(achievement, stats) {
  switch (achievement.criteriaType) {
    case 'lessons':
      return stats.totalLessons >= achievement.criteriaValue;
    case 'streak':
      return stats.currentStreak >= achievement.criteriaValue || stats.longestStreak >= achievement.criteriaValue;
    case 'perfect':
      return stats.perfectLessons >= achievement.criteriaValue;
    case 'xp':
      return stats.totalXP >= achievement.criteriaValue;
    case 'unit_complete':
      return stats.completedUnits.includes(achievement.criteriaValue);
    default:
      return false;
  }
}

// Calculate progress towards achievement
function getProgress(achievement, stats) {
  switch (achievement.criteriaType) {
    case 'lessons':
      return Math.min(100, (stats.totalLessons / achievement.criteriaValue) * 100);
    case 'streak':
      return Math.min(100, (Math.max(stats.currentStreak, stats.longestStreak) / achievement.criteriaValue) * 100);
    case 'perfect':
      return Math.min(100, (stats.perfectLessons / achievement.criteriaValue) * 100);
    case 'xp':
      return Math.min(100, (stats.totalXP / achievement.criteriaValue) * 100);
    case 'unit_complete':
      return stats.completedUnits.includes(achievement.criteriaValue) ? 100 : 0;
    default:
      return 0;
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user's earned achievements
    const earnedResult = await env.DB.prepare(`
      SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?
    `).bind(user.id).all();
    
    const earnedMap = new Map();
    for (const row of earnedResult.results || []) {
      earnedMap.set(row.achievement_id, row.earned_at);
    }
    
    // Get user stats
    const stats = await getUserStats(env.DB, user.id);
    
    // Build achievements list with progress
    const achievements = ACHIEVEMENTS.map(a => {
      const earned = earnedMap.has(a.id);
      const earnedAt = earnedMap.get(a.id);
      const wouldBeEarned = isAchievementEarned(a, stats);
      
      return {
        id: a.id,
        name: a.name,
        name_zh: a.name_zh,
        description: a.description,
        tier: a.tier,
        xpReward: a.xpReward,
        criteriaType: a.criteriaType,
        criteriaValue: a.criteriaValue,
        
        // User progress
        earned,
        earnedAt,
        progress: earned ? 100 : getProgress(a, stats),
        
        // Badge styling
        badgeIcon: getBadgeIcon(a.criteriaType, a.tier),
        badgeColor: getBadgeColor(a.tier),
      };
    });
    
    // Check for newly earned achievements (not yet in database)
    const newlyEarned = [];
    for (const a of achievements) {
      if (!a.earned && a.progress >= 100) {
        // Award this achievement
        try {
          await env.DB.prepare(`
            INSERT INTO user_achievements (user_id, achievement_id, earned_at) VALUES (?, ?, ?)
          `).bind(user.id, a.id, Date.now()).run();
          
          a.earned = true;
          a.earnedAt = Date.now();
          a.justEarned = true;
          newlyEarned.push(a);
        } catch (e) {
          // May already exist
        }
      }
    }
    
    // Sort: earned first, then by tier
    achievements.sort((a, b) => {
      if (a.earned !== b.earned) return b.earned ? 1 : -1;
      return b.tier - a.tier;
    });
    
    return Response.json({
      success: true,
      stats,
      achievements,
      newlyEarned,
      summary: {
        total: achievements.length,
        earned: achievements.filter(a => a.earned).length,
        totalXPFromAchievements: achievements.filter(a => a.earned).reduce((sum, a) => sum + (a.xpReward || 0), 0),
      },
    });
    
  } catch (err) {
    console.error('Achievements error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function getBadgeIcon(criteriaType, tier) {
  const icons = {
    lessons: ['📚', '📖', '🏆'],
    streak: ['🔥', '⚡', '💫'],
    perfect: ['✨', '⭐', '🌟'],
    xp: ['💎', '💠', '💍'],
    unit_complete: ['🎓', '👑', '🏅'],
  };
  return icons[criteriaType]?.[tier - 1] || '🏆';
}

function getBadgeColor(tier) {
  const colors = {
    1: '#cd7f32', // Bronze
    2: '#c0c0c0', // Silver
    3: '#ffd700', // Gold
  };
  return colors[tier] || '#ffd700';
}

