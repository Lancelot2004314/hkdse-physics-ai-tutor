/**
 * HKDSE Physics AI Tutor - Admin Stats API
 * Returns dashboard statistics
 */

import { jsonResponse, errorResponse, corsHeaders } from '../../../shared/auth.js';
import { getTokenStats } from '../../../shared/tokenUsage.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get user statistics
    const userStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today_users
      FROM users
    `).first();

    // Get history statistics
    const historyStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_history,
        SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today_history
      FROM history
    `).first();

    // Get token usage statistics
    const tokenStats = await getTokenStats(env.DB);

    // Get recent activity (last 7 days)
    const dailyActivity = await env.DB.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as count
      FROM history
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).all();

    // Get token usage by day (last 7 days)
    const dailyTokens = await env.DB.prepare(`
      SELECT 
        date(created_at) as date,
        model,
        SUM(total_tokens) as tokens
      FROM token_usage
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at), model
      ORDER BY date DESC
    `).all();

    return jsonResponse({
      users: {
        total: userStats?.total_users || 0,
        today: userStats?.today_users || 0
      },
      history: {
        total: historyStats?.total_history || 0,
        today: historyStats?.today_history || 0
      },
      tokens: {
        overall: tokenStats.overall,
        byModel: tokenStats.byModel,
        todayByModel: tokenStats.todayByModel
      },
      activity: {
        daily: dailyActivity.results || [],
        dailyTokens: dailyTokens.results || []
      }
    });

  } catch (err) {
    console.error('Error fetching admin stats:', err);
    return errorResponse(500, '獲取統計數據失敗');
  }
}
