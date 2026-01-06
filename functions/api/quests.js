/**
 * Quests API
 * GET /api/quests - Get daily quests with user progress
 * POST /api/quests - Claim a completed quest reward
 */

import { getUserFromSession, getCorsHeaders, generateId } from '../../shared/auth.js';

// Default quest definitions (fallback if DB not populated)
const DEFAULT_QUESTS = [
  { id: 'daily-xp-10', name: 'Earn 10 XP', name_zh: '獲得 10 XP', icon: '⚡', criteria_type: 'xp', criteria_value: 10, reward_type: 'gems', reward_amount: 5, display_order: 1 },
  { id: 'daily-lessons-3', name: 'Complete 3 Lessons', name_zh: '完成 3 個課程', icon: '📚', criteria_type: 'lessons', criteria_value: 3, reward_type: 'gems', reward_amount: 10, display_order: 2 },
  { id: 'daily-perfect-1', name: 'Complete a Perfect Lesson', name_zh: '完成一個完美課程', icon: '⭐', criteria_type: 'perfect_lessons', criteria_value: 1, reward_type: 'gems', reward_amount: 20, display_order: 3 },
];

// Get today's date in YYYY-MM-DD format (Hong Kong timezone)
function getTodayDate() {
  const now = new Date();
  // Convert to HKT (UTC+8)
  const hktOffset = 8 * 60 * 60 * 1000;
  const hktDate = new Date(now.getTime() + hktOffset);
  return hktDate.toISOString().split('T')[0];
}

// Get time until midnight HKT in milliseconds
function getTimeUntilReset() {
  const now = new Date();
  const hktOffset = 8 * 60 * 60 * 1000;
  const hktNow = new Date(now.getTime() + hktOffset);
  
  const midnight = new Date(hktNow);
  midnight.setUTCHours(23, 59, 59, 999);
  
  return midnight.getTime() - hktNow.getTime();
}

// Get user's daily progress from various sources
async function getUserDailyStats(db, userId, date) {
  // Get from user_daily_progress if exists
  const dailyProgress = await db.prepare(`
    SELECT xp_earned, lessons_completed FROM user_daily_progress 
    WHERE user_id = ? AND date = ?
  `).bind(userId, date).first();

  if (dailyProgress) {
    return {
      xp: dailyProgress.xp_earned || 0,
      lessons: dailyProgress.lessons_completed || 0,
      perfect_lessons: 0, // Will calculate below
    };
  }

  // Fallback: calculate from lesson_sessions
  const sessionStats = await db.prepare(`
    SELECT 
      COALESCE(SUM(xp_earned + xp_bonus), 0) as xp,
      COUNT(*) as lessons,
      SUM(CASE WHEN is_perfect = 1 THEN 1 ELSE 0 END) as perfect_lessons
    FROM lesson_sessions 
    WHERE user_id = ? 
      AND status = 'completed'
      AND date(completed_at / 1000, 'unixepoch') = ?
  `).bind(userId, date).first();

  return {
    xp: sessionStats?.xp || 0,
    lessons: sessionStats?.lessons || 0,
    perfect_lessons: sessionStats?.perfect_lessons || 0,
  };
}

// Get user's current streak
async function getUserStreak(db, userId) {
  const streak = await db.prepare(
    'SELECT current_streak FROM user_streaks WHERE user_id = ?'
  ).bind(userId).first();
  return streak?.current_streak || 0;
}

// Ensure user has currency record
async function ensureUserCurrency(db, userId) {
  await db.prepare(`
    INSERT OR IGNORE INTO user_currency (user_id, gems, coins, streak_freezes)
    VALUES (?, 0, 0, 0)
  `).bind(userId).run();
}

// Get user's currency
async function getUserCurrency(db, userId) {
  await ensureUserCurrency(db, userId);
  const currency = await db.prepare(
    'SELECT gems, coins, streak_freezes FROM user_currency WHERE user_id = ?'
  ).bind(userId).first();
  return currency || { gems: 0, coins: 0, streak_freezes: 0 };
}

// Get user's hearts
async function getUserHearts(db, userId) {
  const hearts = await db.prepare(
    'SELECT hearts, max_hearts FROM user_hearts WHERE user_id = ?'
  ).bind(userId).first();
  return hearts || { hearts: 5, max_hearts: 5 };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { headers: getCorsHeaders(request) });
}

/**
 * GET /api/quests - Get daily quests with progress
 */
export async function onRequestGet({ request, env }) {
  const corsHeaders = getCorsHeaders(request);
  
  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const today = getTodayDate();
    
    // Get quest definitions
    let questDefs = [];
    try {
      const result = await env.DB.prepare(`
        SELECT * FROM quest_definitions 
        WHERE quest_type = 'daily' AND is_active = 1
        ORDER BY display_order
      `).all();
      questDefs = result.results || [];
    } catch (e) {
      // Table might not exist yet, use defaults
      console.log('Using default quests, table may not exist:', e.message);
    }
    
    if (questDefs.length === 0) {
      questDefs = DEFAULT_QUESTS;
    }

    // Get user's daily stats
    const dailyStats = await getUserDailyStats(env.DB, user.id, today);
    const currentStreak = await getUserStreak(env.DB, user.id);

    // Get or create quest progress for today
    const quests = [];
    
    for (const def of questDefs.slice(0, 4)) { // Limit to 4 quests per day
      // Get existing progress
      let progress;
      try {
        progress = await env.DB.prepare(`
          SELECT * FROM user_quest_progress 
          WHERE user_id = ? AND quest_id = ? AND quest_date = ?
        `).bind(user.id, def.id, today).first();
      } catch (e) {
        progress = null;
      }

      // Calculate current value based on criteria type
      let currentValue = 0;
      switch (def.criteria_type) {
        case 'xp':
          currentValue = dailyStats.xp;
          break;
        case 'lessons':
          currentValue = dailyStats.lessons;
          break;
        case 'perfect_lessons':
          currentValue = dailyStats.perfect_lessons;
          break;
        case 'streak':
          currentValue = currentStreak;
          break;
      }

      const isCompleted = currentValue >= def.criteria_value;
      const isClaimed = progress?.is_claimed === 1;

      // Create or update progress record
      if (!progress) {
        try {
          await env.DB.prepare(`
            INSERT INTO user_quest_progress 
            (id, user_id, quest_id, quest_date, current_value, target_value, is_completed, is_claimed)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
          `).bind(
            generateId(),
            user.id,
            def.id,
            today,
            currentValue,
            def.criteria_value,
            isCompleted ? 1 : 0
          ).run();
        } catch (e) {
          // Ignore insert errors (table may not exist)
        }
      } else if (progress.current_value !== currentValue || (isCompleted && !progress.is_completed)) {
        try {
          await env.DB.prepare(`
            UPDATE user_quest_progress 
            SET current_value = ?, is_completed = ?, completed_at = ?, updated_at = ?
            WHERE id = ?
          `).bind(
            currentValue,
            isCompleted ? 1 : 0,
            isCompleted && !progress.is_completed ? Date.now() : progress.completed_at,
            Date.now(),
            progress.id
          ).run();
        } catch (e) {
          // Ignore update errors
        }
      }

      quests.push({
        id: def.id,
        name: def.name,
        name_zh: def.name_zh,
        icon: def.icon,
        criteriaType: def.criteria_type,
        currentValue: Math.min(currentValue, def.criteria_value),
        targetValue: def.criteria_value,
        progress: Math.min(100, Math.round((currentValue / def.criteria_value) * 100)),
        rewardType: def.reward_type,
        rewardAmount: def.reward_amount,
        isCompleted,
        isClaimed,
        canClaim: isCompleted && !isClaimed,
      });
    }

    // Get user's currency and hearts
    const currency = await getUserCurrency(env.DB, user.id);
    const hearts = await getUserHearts(env.DB, user.id);

    // Calculate time until reset
    const timeUntilReset = getTimeUntilReset();
    const hoursUntilReset = Math.floor(timeUntilReset / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));

    return new Response(JSON.stringify({
      success: true,
      date: today,
      resetIn: {
        hours: hoursUntilReset,
        minutes: minutesUntilReset,
        ms: timeUntilReset,
      },
      quests,
      dailyStats,
      currency: {
        gems: currency.gems,
        coins: currency.coins,
        streakFreezes: currency.streak_freezes,
      },
      hearts: {
        current: hearts.hearts,
        max: hearts.max_hearts,
      },
      streak: currentStreak,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Quests GET error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

/**
 * POST /api/quests - Claim a completed quest
 * Body: { questId: string }
 */
export async function onRequestPost({ request, env }) {
  const corsHeaders = getCorsHeaders(request);
  
  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await request.json();
    const { questId } = body;

    if (!questId) {
      return new Response(JSON.stringify({ error: 'Quest ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const today = getTodayDate();

    // Get quest progress
    const progress = await env.DB.prepare(`
      SELECT uqp.*, qd.reward_type, qd.reward_amount, qd.name
      FROM user_quest_progress uqp
      JOIN quest_definitions qd ON uqp.quest_id = qd.id
      WHERE uqp.user_id = ? AND uqp.quest_id = ? AND uqp.quest_date = ?
    `).bind(user.id, questId, today).first();

    if (!progress) {
      return new Response(JSON.stringify({ error: 'Quest not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!progress.is_completed) {
      return new Response(JSON.stringify({ error: 'Quest not completed yet' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (progress.is_claimed) {
      return new Response(JSON.stringify({ error: 'Quest already claimed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Award the reward
    await ensureUserCurrency(env.DB, user.id);

    let newBalance = 0;
    const rewardType = progress.reward_type;
    const rewardAmount = progress.reward_amount;

    if (rewardType === 'gems') {
      // Update gems
      await env.DB.prepare(`
        UPDATE user_currency 
        SET gems = gems + ?, updated_at = ?
        WHERE user_id = ?
      `).bind(rewardAmount, Date.now(), user.id).run();

      const updated = await env.DB.prepare(
        'SELECT gems FROM user_currency WHERE user_id = ?'
      ).bind(user.id).first();
      newBalance = updated?.gems || 0;

    } else if (rewardType === 'hearts') {
      // Refill hearts
      await env.DB.prepare(`
        UPDATE user_hearts 
        SET hearts = CASE WHEN hearts + ? > max_hearts THEN max_hearts ELSE hearts + ? END,
            updated_at = ?
        WHERE user_id = ?
      `).bind(rewardAmount, rewardAmount, Date.now(), user.id).run();

    } else if (rewardType === 'streak_freeze') {
      await env.DB.prepare(`
        UPDATE user_currency 
        SET streak_freezes = streak_freezes + ?, updated_at = ?
        WHERE user_id = ?
      `).bind(rewardAmount, Date.now(), user.id).run();
    }

    // Record transaction
    try {
      await env.DB.prepare(`
        INSERT INTO currency_transactions 
        (id, user_id, currency_type, amount, balance_after, source, source_id, description)
        VALUES (?, ?, ?, ?, ?, 'quest', ?, ?)
      `).bind(
        generateId(),
        user.id,
        rewardType,
        rewardAmount,
        newBalance,
        questId,
        `Claimed: ${progress.name}`
      ).run();
    } catch (e) {
      // Ignore transaction logging errors
    }

    // Mark quest as claimed
    await env.DB.prepare(`
      UPDATE user_quest_progress 
      SET is_claimed = 1, claimed_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(Date.now(), Date.now(), progress.id).run();

    // Get updated currency
    const currency = await getUserCurrency(env.DB, user.id);
    const hearts = await getUserHearts(env.DB, user.id);

    return new Response(JSON.stringify({
      success: true,
      message: `Claimed ${rewardAmount} ${rewardType}!`,
      reward: {
        type: rewardType,
        amount: rewardAmount,
      },
      currency: {
        gems: currency.gems,
        coins: currency.coins,
        streakFreezes: currency.streak_freezes,
      },
      hearts: {
        current: hearts.hearts,
        max: hearts.max_hearts,
      },
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Quests POST error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

