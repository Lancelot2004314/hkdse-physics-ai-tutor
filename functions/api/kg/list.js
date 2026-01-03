/**
 * Knowledge Graph List API
 * Returns all nodes and edges for the physics knowledge graph
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
  const { request, env } = context;

  try {
    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type'); // scientist, equation, concept, discovery
    const category = url.searchParams.get('category'); // mechanics, electromagnetism, relativity, quantum, etc.
    const yearFrom = url.searchParams.get('yearFrom');
    const yearTo = url.searchParams.get('yearTo');
    const search = url.searchParams.get('search');

    // Build nodes query
    let nodesWhere = '1=1';
    const nodesParams = [];

    if (type) {
      nodesWhere += ' AND type = ?';
      nodesParams.push(type);
    }
    if (category) {
      nodesWhere += ' AND category = ?';
      nodesParams.push(category);
    }
    if (yearFrom) {
      nodesWhere += ' AND year_start >= ?';
      nodesParams.push(parseInt(yearFrom));
    }
    if (yearTo) {
      nodesWhere += ' AND (year_end <= ? OR (year_end IS NULL AND year_start <= ?))';
      nodesParams.push(parseInt(yearTo), parseInt(yearTo));
    }
    if (search) {
      nodesWhere += ' AND (name LIKE ? OR name_zh LIKE ? OR description LIKE ? OR description_zh LIKE ?)';
      const searchPattern = `%${search}%`;
      nodesParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Fetch nodes
    const nodesResult = await env.DB.prepare(`
      SELECT id, type, name, name_zh, description, description_zh,
             year_start, year_end, image_url, formula, category, metadata,
             created_at, updated_at
      FROM kg_nodes
      WHERE ${nodesWhere}
      ORDER BY year_start ASC NULLS LAST, name ASC
    `).bind(...nodesParams).all();

    // Fetch all edges (we'll filter on frontend if needed)
    const edgesResult = await env.DB.prepare(`
      SELECT id, source_id, target_id, relationship, description, created_at
      FROM kg_edges
      ORDER BY created_at DESC
    `).all();

    // Get categories for filtering
    const categoriesResult = await env.DB.prepare(`
      SELECT DISTINCT category FROM kg_nodes WHERE category IS NOT NULL ORDER BY category
    `).all();

    return new Response(JSON.stringify({
      nodes: nodesResult.results || [],
      edges: edgesResult.results || [],
      categories: (categoriesResult.results || []).map(r => r.category),
      stats: {
        totalNodes: nodesResult.results?.length || 0,
        totalEdges: edgesResult.results?.length || 0,
        nodesByType: {
          scientist: (nodesResult.results || []).filter(n => n.type === 'scientist').length,
          equation: (nodesResult.results || []).filter(n => n.type === 'equation').length,
          concept: (nodesResult.results || []).filter(n => n.type === 'concept').length,
          discovery: (nodesResult.results || []).filter(n => n.type === 'discovery').length,
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Knowledge graph list error:', err);
    return errorResponse(500, 'Failed to fetch knowledge graph');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}


