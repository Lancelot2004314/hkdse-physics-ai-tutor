/**
 * HKDSE Physics AI Tutor - Leaderboard API
 * Returns top users by points (global, weekly, daily)
 * Fixed: daily/weekly queries now properly filter and aggregate
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

    let results;

    if (type === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      
      // For daily, sum scores from quiz_sessions completed today
      results = await env.DB.prepare(`
        SELECT 
          u.id as user_id,
          u.email,
          COALESCE(SUM(qs.score), 0) as points,
          COALESCE(us.current_streak, 0) as streak
        FROM users u
        INNER JOIN quiz_sessions qs ON u.id = qs.user_id
        LEFT JOIN user_scores us ON u.id = us.user_id
        WHERE qs.status = 'completed' AND date(qs.completed_at) = ?
        GROUP BY u.id
        HAVING points > 0
        ORDER BY points DESC
        LIMIT ?
      `).bind(today, limit).all();

    } else if (type === 'weekly') {
      // Get start of current week (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);
      const weekStart = monday.toISOString().split('T')[0];

      results = await env.DB.prepare(`
        SELECT 
          u.id as user_id,
          u.email,
          COALESCE(SUM(qs.score), 0) as points,
          COALESCE(us.current_streak, 0) as streak
        FROM users u
        INNER JOIN quiz_sessions qs ON u.id = qs.user_id
        LEFT JOIN user_scores us ON u.id = us.user_id
        WHERE qs.status = 'completed' AND date(qs.completed_at) >= ?
        GROUP BY u.id
        HAVING points > 0
        ORDER BY points DESC
        LIMIT ?
      `).bind(weekStart, limit).all();

    } else {
      // Global - use total points from user_scores
      results = await env.DB.prepare(`
        SELECT 
          u.id as user_id,
          u.email,
          COALESCE(us.total_points, 0) as points,
          COALESCE(us.current_streak, 0) as streak,
          us.correct_count,
          us.best_streak
        FROM users u
        INNER JOIN user_scores us ON u.id = us.user_id
        WHERE us.total_points > 0
        ORDER BY us.total_points DESC
        LIMIT ?
      `).bind(limit).all();
    }

    return buildResponse(results?.results || [], user, env, type);

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
    try {
      const userScores = await env.DB.prepare(`
        SELECT total_points, current_streak, correct_count FROM user_scores WHERE user_id = ?
      `).bind(user.id).first();

      if (userScores) {
        if (type === 'global') {
          // Calculate user's global rank
          const rankResult = await env.DB.prepare(`
            SELECT COUNT(*) + 1 as rank FROM user_scores WHERE total_points > ?
          `).bind(userScores.total_points || 0).first();
          
          userRank = {
            rank: rankResult?.rank || 1,
            name: maskEmail(user.email),
            points: userScores.total_points || 0,
            streak: userScores.current_streak || 0,
            isCurrentUser: true,
          };
        } else {
          // For daily/weekly, find user in results by matching masked email
          const userMaskedEmail = maskEmail(user.email);
          const userInList = leaderboard.find(l => l.name === userMaskedEmail);
          
          if (userInList) {
            userRank = { ...userInList, isCurrentUser: true };
          } else {
            userRank = {
              rank: '-',
              name: userMaskedEmail,
              points: 0,
              streak: userScores.current_streak || 0,
              isCurrentUser: true,
            };
          }
        }
      } else {
        // User has no scores yet
        userRank = {
          rank: '-',
          name: maskEmail(user.email),
          points: 0,
          streak: 0,
          isCurrentUser: true,
        };
      }
    } catch (err) {
      console.error('Error getting user rank:', err);
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
  const parts = email.split('@');
  if (parts.length !== 2) return 'Anonymous';
  
  const [local, domain] = parts;
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
