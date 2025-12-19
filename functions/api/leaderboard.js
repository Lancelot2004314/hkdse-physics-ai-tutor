/**
 * HKDSE Physics AI Tutor - Leaderboard API
 * Returns top users by points (global, weekly, daily)
 */

import { getUserFromSession } from '../../shared/auth.js';

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
    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'global';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    // Get current user for their rank
    const user = await getUserFromSession(request, env);

    let leaderboardQuery;
    let dateFilter = '';

    // Build query based on type
    if (type === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      // For daily, we sum points earned today from practice_history
      leaderboardQuery = `
        SELECT 
          u.email,
          COALESCE(SUM(ph.points_earned), 0) as points,
          us.current_streak as streak,
          COUNT(CASE WHEN ph.is_correct = 1 THEN 1 END) as correct_today
        FROM users u
        LEFT JOIN user_scores us ON u.id = us.user_id
        LEFT JOIN practice_history ph ON u.id = ph.user_id AND date(ph.created_at) = ?
        GROUP BY u.id
        HAVING points > 0
        ORDER BY points DESC
        LIMIT ?
      `;
      const results = await env.DB.prepare(leaderboardQuery).bind(today, limit).all();
      
      return buildResponse(results.results, user, env, type);
    } else if (type === 'weekly') {
      // Get start of current week (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const weekStart = monday.toISOString().split('T')[0];

      leaderboardQuery = `
        SELECT 
          u.email,
          COALESCE(SUM(ph.points_earned), 0) as points,
          us.current_streak as streak,
          COUNT(CASE WHEN ph.is_correct = 1 THEN 1 END) as correct_this_week
        FROM users u
        LEFT JOIN user_scores us ON u.id = us.user_id
        LEFT JOIN practice_history ph ON u.id = ph.user_id AND date(ph.created_at) >= ?
        GROUP BY u.id
        HAVING points > 0
        ORDER BY points DESC
        LIMIT ?
      `;
      const results = await env.DB.prepare(leaderboardQuery).bind(weekStart, limit).all();
      
      return buildResponse(results.results, user, env, type);
    } else {
      // Global - use total points from user_scores
      leaderboardQuery = `
        SELECT 
          u.email,
          us.total_points as points,
          us.current_streak as streak,
          us.correct_count,
          us.best_streak
        FROM users u
        INNER JOIN user_scores us ON u.id = us.user_id
        WHERE us.total_points > 0
        ORDER BY us.total_points DESC
        LIMIT ?
      `;
      const results = await env.DB.prepare(leaderboardQuery).bind(limit).all();
      
      return buildResponse(results.results, user, env, type);
    }

  } catch (err) {
    console.error('Error in leaderboard:', err);
    return errorResponse(500, 'Failed to fetch leaderboard');
  }
}

async function buildResponse(results, user, env, type) {
  // Format leaderboard entries (hide full email for privacy)
  const leaderboard = results.map((row, index) => ({
    rank: index + 1,
    name: maskEmail(row.email),
    points: row.points || 0,
    streak: row.streak || 0,
  }));

  // Get current user's rank if logged in
  let userRank = null;
  if (user) {
    const userScores = await env.DB.prepare(`
      SELECT total_points, current_streak, correct_count FROM user_scores WHERE user_id = ?
    `).bind(user.id).first();

    if (userScores) {
      // Calculate user's rank
      let rankQuery;
      if (type === 'global') {
        rankQuery = `
          SELECT COUNT(*) + 1 as rank FROM user_scores WHERE total_points > ?
        `;
        const rankResult = await env.DB.prepare(rankQuery).bind(userScores.total_points).first();
        userRank = {
          rank: rankResult?.rank || 1,
          name: maskEmail(user.email),
          points: userScores.total_points,
          streak: userScores.current_streak,
          isCurrentUser: true,
        };
      } else {
        // For daily/weekly, find user in results
        const userInList = leaderboard.find(l => l.name === maskEmail(user.email));
        if (userInList) {
          userRank = { ...userInList, isCurrentUser: true };
        } else {
          userRank = {
            rank: '-',
            name: maskEmail(user.email),
            points: 0,
            streak: userScores.current_streak,
            isCurrentUser: true,
          };
        }
      }
    }
  }

  return new Response(JSON.stringify({
    type,
    leaderboard,
    userRank,
    timestamp: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Mask email for privacy (show first 2 chars + *** + @domain)
function maskEmail(email) {
  if (!email) return 'Anonymous';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local}***@${domain}`;
  }
  return `${local.substring(0, 2)}***@${domain}`;
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
