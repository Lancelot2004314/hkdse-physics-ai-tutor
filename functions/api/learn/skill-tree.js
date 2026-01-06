/**
 * Skill Tree API
 * GET /api/learn/skill-tree - Get skill tree configuration with user progress
 * POST /api/learn/skill-tree/unlock - Unlock a new skill node
 */

import { SKILL_TREE_UNITS, SKILL_TREE_NODES, XP_CONFIG } from '../../../shared/skillTreeConfig.js';
import { parseSessionCookie, hashToken } from '../../../shared/auth.js';

// Helper to get user from session (using same method as me.js)
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
    'SELECT id, email, name as display_name, avatar_url FROM users WHERE id = ?'
  ).bind(session.user_id).first();
}

// Get user's skill progress for all nodes with strength decay calculation
async function getUserSkillProgress(db, userId) {
  const results = await db.prepare(`
    SELECT skill_node_id, current_level, xp_earned, lessons_completed, 
           perfect_lessons, current_streak, best_streak, strength,
           last_practiced_at, next_review_at
    FROM user_skill_progress 
    WHERE user_id = ?
  `).bind(userId).all();

  const progressMap = {};
  const now = Date.now();

  for (const row of results.results || []) {
    // Calculate strength decay based on time since last practice
    // Decay formula: strength decreases by ~10% per day after next_review_at
    let effectiveStrength = row.strength || 1.0;

    if (row.last_practiced_at && row.current_level > 0) {
      // Time-based decay: strength decays after the review date
      const reviewDate = row.next_review_at || (row.last_practiced_at + 24 * 60 * 60 * 1000);

      if (now > reviewDate) {
        const daysSinceReview = (now - reviewDate) / (24 * 60 * 60 * 1000);
        // Exponential decay: strength = base * 0.9^days (lose ~10% per day)
        const decayFactor = Math.pow(0.9, daysSinceReview);
        effectiveStrength = Math.max(0.1, row.strength * decayFactor);
      }
    }

    progressMap[row.skill_node_id] = {
      ...row,
      strength: effectiveStrength,
      originalStrength: row.strength, // Keep original for reference
    };
  }
  return progressMap;
}

// Get user hearts
async function getUserHearts(db, userId) {
  let hearts = await db.prepare(
    'SELECT * FROM user_hearts WHERE user_id = ?'
  ).bind(userId).first();

  if (!hearts) {
    // Create initial hearts record
    await db.prepare(`
      INSERT INTO user_hearts (user_id, hearts, max_hearts, last_refill_at)
      VALUES (?, 5, 5, ?)
    `).bind(userId, Date.now()).run();

    hearts = { hearts: 5, max_hearts: 5, last_refill_at: Date.now() };
  }

  // Calculate heart refill (1 heart per 4 hours)
  const refillInterval = 4 * 60 * 60 * 1000; // 4 hours in ms
  const timeSinceRefill = Date.now() - (hearts.last_refill_at || 0);
  const heartsToAdd = Math.floor(timeSinceRefill / refillInterval);

  if (heartsToAdd > 0 && hearts.hearts < hearts.max_hearts) {
    const newHearts = Math.min(hearts.max_hearts, hearts.hearts + heartsToAdd);
    await db.prepare(`
      UPDATE user_hearts SET hearts = ?, last_refill_at = ? WHERE user_id = ?
    `).bind(newHearts, Date.now(), userId).run();
    hearts.hearts = newHearts;
  }

  return hearts;
}

// Get user streak info
async function getUserStreak(db, userId) {
  let streak = await db.prepare(
    'SELECT * FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first();

  if (!streak) {
    streak = { current_streak: 0, longest_streak: 0, last_active_date: null };
  }

  return streak;
}

// Calculate total XP from all skills
async function getTotalXP(db, userId) {
  const result = await db.prepare(`
    SELECT COALESCE(SUM(xp_earned), 0) as total_xp FROM user_skill_progress WHERE user_id = ?
  `).bind(userId).first();

  return result?.total_xp || 0;
}

// Get today's daily progress
async function getDailyProgress(db, userId) {
  const today = new Date().toISOString().split('T')[0];
  const result = await db.prepare(`
    SELECT xp_earned, lessons_completed, goal_xp, goal_met 
    FROM user_daily_progress 
    WHERE user_id = ? AND date = ?
  `).bind(userId, today).first();

  return result || { xp_earned: 0, lessons_completed: 0, goal_xp: 50, goal_met: 0 };
}

// Get total lessons completed across all skills
async function getTotalLessonsCompleted(db, userId) {
  const result = await db.prepare(`
    SELECT COALESCE(SUM(lessons_completed), 0) as total FROM user_skill_progress WHERE user_id = ?
  `).bind(userId).first();

  return result?.total || 0;
}

// Check if a skill node is unlocked based on prerequisites
function isNodeUnlocked(nodeId, progressMap) {
  const node = SKILL_TREE_NODES.find(n => n.id === nodeId);
  if (!node) return false;

  // First node of each unit is always unlocked
  if (!node.prerequisites || node.prerequisites.length === 0) {
    return true;
  }

  // Check if all prerequisites have at least level 1
  return node.prerequisites.every(prereqId => {
    const prereq = progressMap[prereqId];
    return prereq && prereq.current_level >= 1;
  });
}

// Calculate node status
function getNodeStatus(node, progressMap) {
  const progress = progressMap[node.id];
  const isUnlocked = isNodeUnlocked(node.id, progressMap);

  if (!isUnlocked) {
    return 'locked';
  }

  if (!progress || progress.current_level === 0) {
    return 'available';
  }

  if (progress.current_level >= 5) {
    return 'legendary';
  }

  // Check if needs review (strength decay)
  if (progress.strength < 0.5) {
    return 'needs_review';
  }

  return 'in_progress';
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUser(request, env);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user progress data
    const [progressMap, hearts, streak, totalXP, dailyProgress, totalLessons] = await Promise.all([
      getUserSkillProgress(env.DB, user.id),
      getUserHearts(env.DB, user.id),
      getUserStreak(env.DB, user.id),
      getTotalXP(env.DB, user.id),
      getDailyProgress(env.DB, user.id),
      getTotalLessonsCompleted(env.DB, user.id),
    ]);

    // Build skill tree response with progress
    const units = SKILL_TREE_UNITS.map(unit => {
      const nodes = SKILL_TREE_NODES
        .filter(n => n.unitId === unit.id)
        .map(node => {
          const progress = progressMap[node.id] || {
            current_level: 0,
            xp_earned: 0,
            lessons_completed: 0,
            strength: 1.0,
          };

          const status = getNodeStatus(node, progressMap);
          const nextLevelXP = XP_CONFIG.levelThresholds[progress.current_level + 1] || null;

          return {
            id: node.id,
            name: node.name,
            name_zh: node.name_zh,
            description: node.description,
            icon: node.icon,
            order: node.order,
            prerequisites: node.prerequisites,
            hasExtension: node.hasExtension,
            isElective: node.isElective,

            // Progress
            status,
            currentLevel: progress.current_level,
            xpEarned: progress.xp_earned,
            xpToNextLevel: nextLevelXP ? nextLevelXP - progress.xp_earned : null,
            lessonsCompleted: progress.lessons_completed,
            strength: progress.strength,
            needsReview: progress.next_review_at && progress.next_review_at < Date.now(),
          };
        })
        .sort((a, b) => a.order - b.order);

      return {
        id: unit.id,
        name: unit.name,
        name_zh: unit.name_zh,
        description: unit.description,
        icon: unit.icon,
        color: unit.color,
        isElective: unit.isElective,
        nodes,
        // Calculate unit progress
        completedNodes: nodes.filter(n => n.currentLevel >= 5).length,
        totalNodes: nodes.length,
      };
    });

    // Leaderboard unlock requires 10 lessons
    const LEADERBOARD_UNLOCK_LESSONS = 10;
    const lessonsUntilLeaderboard = Math.max(0, LEADERBOARD_UNLOCK_LESSONS - totalLessons);

    return Response.json({
      success: true,
      user: {
        id: user.id,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        totalXP,
        dailyXP: dailyProgress.xp_earned,
        currentStreak: streak.current_streak,
        longestStreak: streak.longest_streak,
        totalLessonsCompleted: totalLessons,
      },
      hearts: {
        current: hearts.hearts,
        max: hearts.max_hearts,
        nextRefillAt: hearts.last_refill_at + 4 * 60 * 60 * 1000,
      },
      leaderboard: {
        unlocked: totalLessons >= LEADERBOARD_UNLOCK_LESSONS,
        lessonsRequired: LEADERBOARD_UNLOCK_LESSONS,
        lessonsRemaining: lessonsUntilLeaderboard,
      },
      dailyGoal: {
        xpEarned: dailyProgress.xp_earned,
        goalXP: dailyProgress.goal_xp,
        goalMet: dailyProgress.goal_met === 1,
        lessonsToday: dailyProgress.lessons_completed,
      },
      units,
      xpConfig: XP_CONFIG,
    });

  } catch (err) {
    console.error('Skill tree error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// Unlock a new skill node
export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { skillNodeId } = body;

    if (!skillNodeId) {
      return Response.json({ error: 'skillNodeId is required' }, { status: 400 });
    }

    const node = SKILL_TREE_NODES.find(n => n.id === skillNodeId);
    if (!node) {
      return Response.json({ error: 'Invalid skill node' }, { status: 400 });
    }

    // Check if already has progress
    const existing = await env.DB.prepare(
      'SELECT * FROM user_skill_progress WHERE user_id = ? AND skill_node_id = ?'
    ).bind(user.id, skillNodeId).first();

    if (existing) {
      return Response.json({ error: 'Skill already unlocked' }, { status: 400 });
    }

    // Check prerequisites
    const progressMap = await getUserSkillProgress(env.DB, user.id);
    if (!isNodeUnlocked(skillNodeId, progressMap)) {
      return Response.json({ error: 'Prerequisites not met' }, { status: 400 });
    }

    // Create initial progress
    await env.DB.prepare(`
      INSERT INTO user_skill_progress (user_id, skill_node_id, current_level, xp_earned, lessons_completed)
      VALUES (?, ?, 0, 0, 0)
    `).bind(user.id, skillNodeId).run();

    return Response.json({
      success: true,
      message: `Unlocked skill: ${node.name}`,
      skillNodeId,
    });

  } catch (err) {
    console.error('Unlock error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

