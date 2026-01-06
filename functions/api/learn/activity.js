/**
 * Activity API
 * GET /api/learn/activity - Get user's daily activity for the last N days
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
    'SELECT id, email FROM users WHERE id = ?'
  ).bind(session.user_id).first();
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get days parameter (default 30)
    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get('days')) || 30, 90);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Fetch daily progress from database
    const result = await env.DB.prepare(`
      SELECT date, xp_earned, lessons_completed, goal_met
      FROM user_daily_progress
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(user.id, startDateStr, endDateStr).all();
    
    // Create a map of date -> activity
    const activityMap = new Map();
    for (const row of result.results || []) {
      activityMap.set(row.date, {
        date: row.date,
        xp: row.xp_earned,
        lessons: row.lessons_completed,
        goalMet: row.goal_met === 1,
      });
    }
    
    // Fill in all days (including days with no activity)
    const activity = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      activity.push(activityMap.get(dateStr) || {
        date: dateStr,
        xp: 0,
        lessons: 0,
        goalMet: false,
      });
      current.setDate(current.getDate() + 1);
    }
    
    // Calculate summary stats
    const totalXP = activity.reduce((sum, d) => sum + d.xp, 0);
    const activeDays = activity.filter(d => d.xp > 0).length;
    const goalsMetCount = activity.filter(d => d.goalMet).length;
    
    return Response.json({
      success: true,
      activity,
      summary: {
        days,
        totalXP,
        activeDays,
        goalsMetCount,
      },
    });
    
  } catch (err) {
    console.error('Activity error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

