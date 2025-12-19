/**
 * Statistics API
 * Returns user statistics for the Statistics page
 * Fixed: SQL injection vulnerability - now uses parameterized queries
 */

import { getUserFromSession } from '../../shared/auth.js';
import { calculateGrade } from '../../shared/topics.js';

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
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '1Y';
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    // Calculate date range - use parameterized queries to prevent SQL injection
    let startDateStr = null;
    let endDateStr = null;
    const now = new Date();

    if (fromDate && toDate) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(fromDate) && dateRegex.test(toDate)) {
        startDateStr = fromDate;
        endDateStr = toDate;
      }
    } else {
      switch (period) {
        case '7D':
          startDateStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '1M':
          startDateStr = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '3M':
          startDateStr = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '6M':
          startDateStr = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '1Y':
          startDateStr = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        default:
          // ALL - no date filter
          startDateStr = null;
      }
    }

    // Get overview statistics with parameterized query
    let stats;
    if (startDateStr && endDateStr) {
      stats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as practices_done,
          COALESCE(SUM(mc_count + short_count + long_count), 0) as questions_done,
          COALESCE(SUM(time_spent), 0) as total_time,
          AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score
        FROM quiz_sessions 
        WHERE user_id = ? AND status = 'completed' 
          AND date(completed_at) >= ? AND date(completed_at) <= ?
      `).bind(user.id, startDateStr, endDateStr).first();
    } else if (startDateStr) {
      stats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as practices_done,
          COALESCE(SUM(mc_count + short_count + long_count), 0) as questions_done,
          COALESCE(SUM(time_spent), 0) as total_time,
          AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score
        FROM quiz_sessions 
        WHERE user_id = ? AND status = 'completed' AND date(completed_at) >= ?
      `).bind(user.id, startDateStr).first();
    } else {
      stats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as practices_done,
          COALESCE(SUM(mc_count + short_count + long_count), 0) as questions_done,
          COALESCE(SUM(time_spent), 0) as total_time,
          AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score
        FROM quiz_sessions 
        WHERE user_id = ? AND status = 'completed'
      `).bind(user.id).first();
    }

    // Calculate time per question
    const questionsCount = stats?.questions_done || 0;
    const totalTime = stats?.total_time || 0;
    const timePerQuestion = questionsCount > 0 ? Math.round(totalTime / questionsCount) : 0;

    // Get global ranking
    const rankResult = await env.DB.prepare(`
      SELECT COUNT(*) + 1 as rank FROM (
        SELECT user_id, SUM(score) as total_score
        FROM quiz_sessions
        WHERE status = 'completed'
        GROUP BY user_id
        HAVING total_score > (
          SELECT COALESCE(SUM(score), 0)
          FROM quiz_sessions
          WHERE user_id = ? AND status = 'completed'
        )
      )
    `).bind(user.id).first();

    // Expected grade based on average
    const avgScore = stats?.avg_score || 0;
    const expectedGrade = calculateGrade(avgScore);

    // Get score trend data with parameterized query
    let trendData;
    if (startDateStr && endDateStr) {
      trendData = await env.DB.prepare(`
        SELECT 
          date(completed_at) as date,
          AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score,
          COUNT(*) as count
        FROM quiz_sessions 
        WHERE user_id = ? AND status = 'completed'
          AND date(completed_at) >= ? AND date(completed_at) <= ?
        GROUP BY date(completed_at)
        ORDER BY date ASC
      `).bind(user.id, startDateStr, endDateStr).all();
    } else if (startDateStr) {
      trendData = await env.DB.prepare(`
        SELECT 
          date(completed_at) as date,
          AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score,
          COUNT(*) as count
        FROM quiz_sessions 
        WHERE user_id = ? AND status = 'completed' AND date(completed_at) >= ?
        GROUP BY date(completed_at)
        ORDER BY date ASC
      `).bind(user.id, startDateStr).all();
    } else {
      trendData = await env.DB.prepare(`
        SELECT 
          date(completed_at) as date,
          AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score,
          COUNT(*) as count
        FROM quiz_sessions 
        WHERE user_id = ? AND status = 'completed'
        GROUP BY date(completed_at)
        ORDER BY date ASC
      `).bind(user.id).all();
    }

    // Get by-chapter statistics with parameterized query
    let byChapterData;
    if (startDateStr && endDateStr) {
      byChapterData = await env.DB.prepare(`
        SELECT 
          topics,
          COUNT(*) as count,
          AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score
        FROM quiz_sessions 
        WHERE user_id = ? AND status = 'completed'
          AND date(completed_at) >= ? AND date(completed_at) <= ?
        GROUP BY topics
      `).bind(user.id, startDateStr, endDateStr).all();
    } else if (startDateStr) {
      byChapterData = await env.DB.prepare(`
        SELECT 
          topics,
          COUNT(*) as count,
          AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score
        FROM quiz_sessions 
        WHERE user_id = ? AND status = 'completed' AND date(completed_at) >= ?
        GROUP BY topics
      `).bind(user.id, startDateStr).all();
    } else {
      byChapterData = await env.DB.prepare(`
        SELECT 
          topics,
          COUNT(*) as count,
          AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score
        FROM quiz_sessions 
        WHERE user_id = ? AND status = 'completed'
        GROUP BY topics
      `).bind(user.id).all();
    }

    // Process by-chapter data
    const chapterStats = {};
    const chapterResults = byChapterData?.results || [];
    chapterResults.forEach(row => {
      try {
        const topics = JSON.parse(row.topics || '[]');
        topics.forEach(topic => {
          if (!chapterStats[topic]) {
            chapterStats[topic] = { count: 0, totalScore: 0 };
          }
          chapterStats[topic].count += row.count;
          chapterStats[topic].totalScore += (row.avg_score || 0) * row.count;
        });
      } catch (e) {
        console.error('Error parsing topics:', e);
      }
    });

    const byChapter = Object.entries(chapterStats).map(([topic, data]) => ({
      topic,
      practiceCount: data.count,
      avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
    }));

    return new Response(JSON.stringify({
      overview: {
        practicesDone: stats?.practices_done || 0,
        questionsDone: questionsCount,
        timePerQuestion: timePerQuestion,
        avgScore: Math.round(avgScore || 0),
        globalRanking: rankResult?.rank || 1,
        expectedGrade,
      },
      trend: (trendData?.results || []).map(d => ({
        date: d.date,
        avgScore: Math.round(d.avg_score || 0),
        count: d.count,
      })),
      byChapter,
      period,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in stats:', err);
    return errorResponse(500, 'Failed to fetch statistics');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
