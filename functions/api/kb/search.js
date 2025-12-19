/**
 * Knowledge Base Search API
 * Semantic search for relevant content
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { searchKnowledgeBase, formatKnowledgeContext } from '../../../shared/embedding.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // This endpoint can be used by admin for testing
    // or internally by the explain APIs
    const user = await getUserFromSession(request, env);

    // Parse request
    const body = await request.json();
    const {
      query,
      topK = 5,
      minScore = 0.7,
      year,
      topic,
      includeFormatted = false,
    } = body;

    if (!query) {
      return errorResponse(400, 'Query is required');
    }

    if (!env.VECTORIZE) {
      return errorResponse(500, 'Vectorize not configured');
    }

    if (!env.OPENAI_API_KEY) {
      return errorResponse(500, 'OpenAI API key not configured');
    }

    // Build filter
    const filter = {};
    if (year) {
      filter.year = parseInt(year);
    }
    if (topic) {
      filter.topic = topic;
    }

    // Search knowledge base
    const results = await searchKnowledgeBase(query, env, {
      topK,
      minScore,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    const response = {
      results,
      count: results.length,
      query,
    };

    // Optionally include formatted context for prompts
    if (includeFormatted) {
      response.formattedContext = formatKnowledgeContext(results);
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Search error:', err);
    return errorResponse(500, 'Search failed: ' + err.message);
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
