/**
 * Pool Availability API
 * Returns available question counts by type and language
 * Used by frontend to set appropriate limits
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get counts by qtype and language
    const result = await env.DB.prepare(`
      SELECT qtype, language, COUNT(*) as count 
      FROM question_bank 
      WHERE status = 'ready'
      GROUP BY qtype, language
    `).all();

    // Transform to a more usable format
    const availability = {
      mc: { en: 0, zh: 0 },
      short: { en: 0, zh: 0 },
      long: { en: 0, zh: 0 },
    };

    for (const row of result.results) {
      if (availability[row.qtype]) {
        availability[row.qtype][row.language] = row.count;
      }
    }

    // Calculate recommended limits based on availability
    // Rule: Max is min(available / 3, defaultMax) to ensure variety
    const limits = {
      mc: {
        en: Math.min(Math.floor(availability.mc.en / 3), 15),
        zh: Math.min(Math.floor(availability.mc.zh / 3), 15),
      },
      short: {
        en: Math.min(Math.floor(availability.short.en / 3), 8),
        zh: Math.min(Math.floor(availability.short.zh / 3), 8),
      },
      long: {
        en: Math.min(Math.floor(availability.long.en / 3), 5),
        zh: Math.min(Math.floor(availability.long.zh / 3), 5),
      },
    };

    return new Response(JSON.stringify({
      availability,
      limits,
      timestamp: Date.now(),
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in pool-availability:', err);
    return new Response(JSON.stringify({ error: 'Failed to get availability' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

