/**
 * Knowledge Graph Node API
 * Get details of a single node and its connections
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
  const { request, env, params } = context;
  const nodeId = params.id;

  try {
    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    if (!nodeId) {
      return errorResponse(400, 'Node ID is required');
    }

    // Fetch the node
    const node = await env.DB.prepare(`
      SELECT id, type, name, name_zh, description, description_zh,
             year_start, year_end, image_url, formula, category, metadata,
             created_at, updated_at
      FROM kg_nodes
      WHERE id = ?
    `).bind(nodeId).first();

    if (!node) {
      return errorResponse(404, 'Node not found');
    }

    // Fetch connected edges (both incoming and outgoing)
    const outgoingEdges = await env.DB.prepare(`
      SELECT e.id, e.source_id, e.target_id, e.relationship, e.description,
             n.name as target_name, n.name_zh as target_name_zh, n.type as target_type
      FROM kg_edges e
      JOIN kg_nodes n ON e.target_id = n.id
      WHERE e.source_id = ?
    `).bind(nodeId).all();

    const incomingEdges = await env.DB.prepare(`
      SELECT e.id, e.source_id, e.target_id, e.relationship, e.description,
             n.name as source_name, n.name_zh as source_name_zh, n.type as source_type
      FROM kg_edges e
      JOIN kg_nodes n ON e.source_id = n.id
      WHERE e.target_id = ?
    `).bind(nodeId).all();

    // Parse metadata if exists
    let parsedMetadata = null;
    if (node.metadata) {
      try {
        parsedMetadata = JSON.parse(node.metadata);
      } catch (e) {
        parsedMetadata = node.metadata;
      }
    }

    return new Response(JSON.stringify({
      node: {
        ...node,
        metadata: parsedMetadata,
      },
      connections: {
        outgoing: outgoingEdges.results || [],
        incoming: incomingEdges.results || [],
      },
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Knowledge graph node error:', err);
    return errorResponse(500, 'Failed to fetch node details');
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}


