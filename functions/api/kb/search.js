/**
 * Knowledge Base Search API
 * Semantic search for relevant content
 * Uses Vertex AI RAG Engine if configured, falls back to Vectorize
 */

import { getUserFromSession } from '../../../shared/auth.js';
import { searchKnowledgeBase, formatKnowledgeContext } from '../../../shared/embedding.js';
import { checkVertexConfig } from '../../../shared/vertexRag.js';

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
    // or internally by the explain/quiz APIs
    const user = await getUserFromSession(request, env);

    // Parse request
    const body = await request.json();
    const {
      query,
      topK = 5,
      minScore = 0.3, // Vertex AI RAG uses distance scores (lower = more similar)
      year,
      topic,
      language,
      subject,
      docType,
      includeFormatted = false,
    } = body;

    if (!query) {
      return errorResponse(400, 'Query is required');
    }

    // Check backend configuration
    const vertexConfig = checkVertexConfig(env);
    const backend = vertexConfig.configured ? 'vertex_rag' : 'vectorize';

    if (!vertexConfig.configured && !env.VECTORIZE) {
      return errorResponse(500, 'No search backend configured (Vertex RAG or Vectorize)');
    }

    // Build filter
    const filter = {};
    if (year) {
      filter.year = parseInt(year);
    }
    if (topic) {
      filter.topic = topic;
    }
    if (language) {
      filter.language = language;
    }
    if (subject) {
      filter.subject = subject;
    }
    if (docType) {
      filter.doc_type = docType;
    }

    // Search knowledge base (automatically uses Vertex or Vectorize)
    const results = await searchKnowledgeBase(query, env, {
      topK,
      minScore,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    const response = {
      results,
      count: results.length,
      query,
      backend,
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

