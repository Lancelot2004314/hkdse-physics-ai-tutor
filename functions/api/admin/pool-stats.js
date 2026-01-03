/**
 * Admin Pool Stats API
 * Returns question bank inventory statistics by subtopic
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { PHYSICS_TOPICS } from '../../../shared/topics.js';
import { MATH_TOPICS } from '../../../shared/mathTopics.js';

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
    // Check admin auth
    const user = await getUserFromSession(request, env);
    if (!user || !isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    // Parse subject parameter (Physics or Mathematics)
    const url = new URL(request.url);
    const subject = url.searchParams.get('subject') || 'Physics';

    // Get counts grouped by topic_key, language, qtype, status filtered by subject
    const result = await env.DB.prepare(`
      SELECT 
        topic_key,
        language,
        qtype,
        status,
        COUNT(*) as count
      FROM question_bank
      WHERE subject = ?
      GROUP BY topic_key, language, qtype, status
      ORDER BY topic_key, language, qtype, status
    `).bind(subject).all();

    // Get total counts by status for this subject
    const totalsResult = await env.DB.prepare(`
      SELECT status, COUNT(*) as count
      FROM question_bank
      WHERE subject = ?
      GROUP BY status
    `).bind(subject).all();

    // Build a structured response
    const inventory = {};
    const totals = { ready: 0, reserved: 0, used: 0, bad: 0 };

    // Process totals
    for (const row of totalsResult.results || []) {
      totals[row.status] = row.count;
    }

    // Process inventory by subtopic
    for (const row of result.results || []) {
      const key = row.topic_key;
      if (!inventory[key]) {
        inventory[key] = {
          topicKey: key,
          topicName: getTopicName(key, subject),
          en: { mc: { ready: 0, reserved: 0, used: 0 }, short: { ready: 0, reserved: 0, used: 0 }, long: { ready: 0, reserved: 0, used: 0 } },
          zh: { mc: { ready: 0, reserved: 0, used: 0 }, short: { ready: 0, reserved: 0, used: 0 }, long: { ready: 0, reserved: 0, used: 0 } },
        };
      }

      const lang = row.language || 'zh';
      const qtype = row.qtype || 'mc';
      const status = row.status || 'ready';

      if (inventory[key][lang] && inventory[key][lang][qtype]) {
        inventory[key][lang][qtype][status] = row.count;
      }
    }

    // Get list of all subtopics based on subject
    const allSubtopics = getAllSubtopics(subject);

    // Calculate inventory health: how many subtopics have at least 5 ready questions per type/language
    let healthyCount = 0;
    let lowStockCount = 0;
    let emptyCount = 0;

    for (const st of allSubtopics) {
      const inv = inventory[st.id];
      if (!inv) {
        emptyCount++;
        continue;
      }

      // Check if all combinations have at least 5 ready
      let allHealthy = true;
      let anyStock = false;
      for (const lang of ['en', 'zh']) {
        for (const qtype of ['mc', 'short', 'long']) {
          const ready = inv[lang]?.[qtype]?.ready || 0;
          if (ready >= 5) anyStock = true;
          else allHealthy = false;
        }
      }

      if (allHealthy) healthyCount++;
      else if (anyStock) lowStockCount++;
      else emptyCount++;
    }

    return new Response(JSON.stringify({
      subject,
      totals,
      inventory: Object.values(inventory),
      allSubtopics: allSubtopics.map(st => ({ id: st.id, name: st.name, parentTopic: st.parentTopic })),
      health: {
        healthy: healthyCount,
        lowStock: lowStockCount,
        empty: emptyCount,
        total: allSubtopics.length,
      },
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in admin/pool-stats:', err);
    return errorResponse(500, 'Failed to get pool stats: ' + err.message);
  }
}

function getTopicName(topicKey, subject = 'Physics') {
  // Parse topic key like "heat_1" to find the subtopic name
  const TOPICS = subject === 'Mathematics' ? MATH_TOPICS : PHYSICS_TOPICS;
  for (const topic of Object.values(TOPICS)) {
    for (const sub of topic.subtopics || []) {
      if (sub.id === topicKey) {
        return `${topic.name} > ${sub.name}`;
      }
      for (const subsub of sub.subtopics || []) {
        if (subsub.id === topicKey) {
          return `${topic.name} > ${sub.name} > ${subsub.name}`;
        }
      }
    }
  }
  return topicKey;
}

function getAllSubtopics(subject = 'Physics') {
  const result = [];
  const TOPICS = subject === 'Mathematics' ? MATH_TOPICS : PHYSICS_TOPICS;
  for (const topic of Object.values(TOPICS)) {
    for (const sub of topic.subtopics || []) {
      if (sub.subtopics && sub.subtopics.length > 0) {
        for (const subsub of sub.subtopics) {
          result.push({
            id: subsub.id,
            name: subsub.name,
            parentTopic: `${topic.name} > ${sub.name}`,
          });
        }
      } else {
        result.push({
          id: sub.id,
          name: sub.name,
          parentTopic: topic.name,
        });
      }
    }
  }
  return result;
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

