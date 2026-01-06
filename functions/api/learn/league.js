/**
 * Weekly League API
 * GET /api/learn/league - Get current week's league standings
 * POST /api/learn/league/join - Join current week's league
 */

import { getUserFromSession } from '../../../shared/auth.js';

// Helper to get user from session (with display_name alias)
async function getUser(request, env) {
  const user = await getUserFromSession(request, env);
  if (!user) return null;
  
  // Add display_name alias for compatibility
  return {
    ...user,
    display_name: user.name || user.email?.split('@')[0] || 'Anonymous',
  };
}

// Get current week's league ID (YYYY-WW format)
function getCurrentLeagueId() {
  const now = new Date();
  const year = now.getFullYear();
  const onejan = new Date(year, 0, 1);
  const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, '0')}`;
}

// Get week date range
function getWeekDates(leagueId) {
  const [year, week] = leagueId.split('-').map(Number);
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7 - jan1.getDay() + 1;
  const startDate = new Date(year, 0, 1 + daysOffset);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

// Ensure current week's league exists
async function ensureLeagueExists(db, leagueId) {
  const existing = await db.prepare(
    'SELECT id FROM weekly_leagues WHERE id = ?'
  ).bind(leagueId).first();
  
  if (!existing) {
    const { startDate, endDate } = getWeekDates(leagueId);
    await db.prepare(`
      INSERT INTO weekly_leagues (id, start_date, end_date, status, created_at)
      VALUES (?, ?, ?, 'active', ?)
    `).bind(leagueId, startDate, endDate, Date.now()).run();
  }
  
  return leagueId;
}

// Calculate XP earned this week for a user
async function getWeeklyXP(db, userId, startDate) {
  const result = await db.prepare(`
    SELECT COALESCE(SUM(xp_earned), 0) as xp
    FROM user_daily_progress
    WHERE user_id = ? AND date >= ?
  `).bind(userId, startDate).first();
  
  return result?.xp || 0;
}

// Get tier based on historical performance
function getUserTier(totalXP, weeksParticipated) {
  if (weeksParticipated < 2) return 'bronze';
  if (totalXP >= 10000) return 'diamond';
  if (totalXP >= 5000) return 'gold';
  if (totalXP >= 2000) return 'silver';
  return 'bronze';
}

// GET - Get current week's league standings
export async function onRequestGet({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const leagueId = getCurrentLeagueId();
    await ensureLeagueExists(env.DB, leagueId);
    
    const { startDate, endDate } = getWeekDates(leagueId);
    
    // Get all participants for this league
    const participantsResult = await env.DB.prepare(`
      SELECT 
        lp.user_id,
        lp.xp_earned,
        lp.tier,
        u.display_name,
        u.avatar_url
      FROM league_participants lp
      JOIN users u ON lp.user_id = u.id
      WHERE lp.league_id = ?
      ORDER BY lp.xp_earned DESC
    `).bind(leagueId).all();
    
    const participants = participantsResult.results || [];
    
    // Update XP for each participant from daily progress
    for (const p of participants) {
      const currentXP = await getWeeklyXP(env.DB, p.user_id, startDate);
      if (currentXP !== p.xp_earned) {
        await env.DB.prepare(`
          UPDATE league_participants SET xp_earned = ? WHERE league_id = ? AND user_id = ?
        `).bind(currentXP, leagueId, p.user_id).run();
        p.xp_earned = currentXP;
      }
    }
    
    // Sort by XP and assign ranks
    participants.sort((a, b) => b.xp_earned - a.xp_earned);
    
    const leaderboard = participants.map((p, index) => {
      const rank = index + 1;
      const isCurrentUser = p.user_id === user.id;
      const inPromotionZone = rank <= 3;
      const inDemotionZone = rank > participants.length - 3 && participants.length > 5;
      
      return {
        rank,
        userId: p.user_id,
        displayName: p.display_name || 'Anonymous',
        avatarUrl: p.avatar_url,
        xpEarned: p.xp_earned,
        tier: p.tier || 'bronze',
        isCurrentUser,
        inPromotionZone,
        inDemotionZone,
      };
    });
    
    // Find current user's position
    const currentUserEntry = leaderboard.find(p => p.isCurrentUser);
    const isParticipating = !!currentUserEntry;
    
    // Calculate time remaining
    const endDateTime = new Date(endDate + 'T23:59:59');
    const timeRemaining = Math.max(0, endDateTime.getTime() - Date.now());
    const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
    
    return Response.json({
      success: true,
      league: {
        id: leagueId,
        startDate,
        endDate,
        daysRemaining,
        status: 'active',
      },
      currentUser: {
        isParticipating,
        rank: currentUserEntry?.rank || null,
        xpEarned: currentUserEntry?.xpEarned || 0,
        tier: currentUserEntry?.tier || 'bronze',
      },
      leaderboard: leaderboard.slice(0, 50), // Top 50
      totalParticipants: participants.length,
      promotionCount: 3,
      demotionCount: Math.min(3, Math.max(0, participants.length - 5)),
    });
    
  } catch (err) {
    console.error('League GET error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST - Join current week's league
export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const leagueId = getCurrentLeagueId();
    await ensureLeagueExists(env.DB, leagueId);
    
    const { startDate } = getWeekDates(leagueId);
    
    // Check if already participating
    const existing = await env.DB.prepare(
      'SELECT * FROM league_participants WHERE league_id = ? AND user_id = ?'
    ).bind(leagueId, user.id).first();
    
    if (existing) {
      return Response.json({
        success: false,
        error: 'Already participating in this week\'s league',
      });
    }
    
    // Get current week's XP
    const currentXP = await getWeeklyXP(env.DB, user.id, startDate);
    
    // Get user's tier from total XP
    const totalXPResult = await env.DB.prepare(`
      SELECT COALESCE(SUM(xp_earned), 0) as total FROM user_skill_progress WHERE user_id = ?
    `).bind(user.id).first();
    
    const tier = getUserTier(totalXPResult?.total || 0, 0);
    
    // Join league
    await env.DB.prepare(`
      INSERT INTO league_participants (league_id, user_id, xp_earned, tier)
      VALUES (?, ?, ?, ?)
    `).bind(leagueId, user.id, currentXP, tier).run();
    
    // Get current rank
    const rankResult = await env.DB.prepare(`
      SELECT COUNT(*) as rank FROM league_participants
      WHERE league_id = ? AND xp_earned > ?
    `).bind(leagueId, currentXP).first();
    
    return Response.json({
      success: true,
      message: 'Joined this week\'s league!',
      leagueId,
      currentRank: (rankResult?.rank || 0) + 1,
      currentXP,
      tier,
    });
    
  } catch (err) {
    console.error('League POST error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

