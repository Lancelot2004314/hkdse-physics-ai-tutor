/**
 * Statistics API
 * Returns user statistics for the Statistics page
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
    const period = url.searchParams.get('period') || '1Y'; // 7D, 1M, 3M, 6M, 1Y, ALL
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    // Calculate date range
    let dateFilter = '';
    const now = new Date();
    let startDate;

    if (fromDate && toDate) {
      dateFilter = `AND completed_at >= '${fromDate}' AND completed_at <= '${toDate}'`;
    } else {
      switch (period) {
        case '7D':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1M':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3M':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '6M':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case '1Y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = null;
      }
      if (startDate) {
        dateFilter = `AND completed_at >= '${startDate.toISOString()}'`;
      }
    }

    // Get overview statistics
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as practices_done,
        SUM(mc_count + short_count + long_count) as questions_done,
        SUM(time_spent) as total_time,
        AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score
      FROM quiz_sessions 
      WHERE user_id = ? AND status = 'completed' ${dateFilter}
    `).bind(user.id).first();

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

    // Get score trend data for chart
    const trendData = await env.DB.prepare(`
      SELECT 
        date(completed_at) as date,
        AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score,
        COUNT(*) as count
      FROM quiz_sessions 
      WHERE user_id = ? AND status = 'completed' ${dateFilter}
      GROUP BY date(completed_at)
      ORDER BY date ASC
    `).bind(user.id).all();

    // Get by-chapter statistics
    const byChapterData = await env.DB.prepare(`
      SELECT 
        topics,
        COUNT(*) as count,
        AVG(CASE WHEN max_score > 0 THEN (score * 100.0 / max_score) ELSE 0 END) as avg_score
      FROM quiz_sessions 
      WHERE user_id = ? AND status = 'completed' ${dateFilter}
      GROUP BY topics
    `).bind(user.id).all();

    // Process by-chapter data
    const chapterStats = {};
    byChapterData.results.forEach(row => {
      const topics = JSON.parse(row.topics || '[]');
      topics.forEach(topic => {
        if (!chapterStats[topic]) {
          chapterStats[topic] = { count: 0, totalScore: 0 };
        }
        chapterStats[topic].count += row.count;
        chapterStats[topic].totalScore += row.avg_score * row.count;
      });
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
        avgScore: Math.round(avgScore),
        globalRanking: rankResult?.rank || 1,
        expectedGrade,
      },
      trend: trendData.results.map(d => ({
        date: d.date,
        avgScore: Math.round(d.avg_score),
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
