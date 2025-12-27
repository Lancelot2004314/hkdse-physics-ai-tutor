/**
 * Knowledge Base Connection Test API
 * Tests all required services: D1, Vertex AI RAG, GCS, Vectorize (fallback), Gemini, R2 (legacy)
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';
import { checkVertexConfig } from '../../../shared/vertexRag.js';
import { getGoogleAccessToken, getGcpConfig } from '../../../shared/googleAuth.js';

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
    // Check authentication
    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    // Check admin permission
    if (!isAdmin(user.email, env)) {
      return errorResponse(403, 'Admin access required');
    }

    // Run all tests
    const results = {
      d1: await testD1(env),
      vertex: await testVertexRAG(env),
      gcs: await testGCS(env),
      vectorize: await testVectorize(env),
      openai: await testOpenAI(env),
      r2: await testR2(env),
    };

    // Calculate overall status
    const allOk = Object.values(results).every(r => r.status === 'ok');
    const hasError = Object.values(results).some(r => r.status === 'error');

    return new Response(JSON.stringify({
      overall: hasError ? 'error' : (allOk ? 'ok' : 'warning'),
      results,
      timestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Test error:', err);
    return errorResponse(500, 'Test failed: ' + err.message);
  }
}

/**
 * Test D1 Database connection
 */
async function testD1(env) {
  const start = Date.now();

  if (!env.DB) {
    return {
      status: 'error',
      message: 'D1 Database not bound',
      hint: 'Check wrangler.toml [[d1_databases]] binding',
    };
  }

  try {
    // Test with a simple query
    const result = await env.DB.prepare('SELECT COUNT(*) as count FROM kb_documents').first();
    const latency = Date.now() - start;

    return {
      status: 'ok',
      message: `Connected (${result?.count || 0} documents)`,
      latency: `${latency}ms`,
    };
  } catch (err) {
    // Check if table doesn't exist
    if (err.message?.includes('no such table')) {
      return {
        status: 'warning',
        message: 'Table kb_documents not found',
        hint: 'Run migration: wrangler d1 execute DB --file=migrations/0005_knowledge_base.sql',
      };
    }
    return {
      status: 'error',
      message: err.message,
    };
  }
}

/**
 * Test Vertex AI RAG Engine connection
 */
async function testVertexRAG(env) {
  const config = checkVertexConfig(env);

  if (!config.configured) {
    return {
      status: 'warning',
      message: 'Vertex AI RAG not configured',
      hint: config.issues.join(', '),
    };
  }

  const start = Date.now();

  try {
    // Get access token to verify service account
    await getGoogleAccessToken(env);

    // Try to list RAG files (simple API call to verify corpus access)
    const gcpConfig = getGcpConfig(env);
    const corpusName = `projects/${gcpConfig.projectId}/locations/${gcpConfig.location}/ragCorpora/${gcpConfig.corpusId}`;
    const url = `https://${gcpConfig.location}-aiplatform.googleapis.com/v1beta1/${corpusName}/ragFiles?pageSize=1`;

    const accessToken = await getGoogleAccessToken(env);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 404) {
        return {
          status: 'error',
          message: 'Corpus not found',
          hint: 'Check VERTEX_RAG_CORPUS_ID and GCP_LOCATION',
        };
      }
      return {
        status: 'error',
        message: `API error: ${response.status}`,
        hint: error.substring(0, 100),
      };
    }

    const data = await response.json();
    const fileCount = data.ragFiles?.length || 0;

    return {
      status: 'ok',
      message: `RAG Engine ready (${fileCount}+ files in corpus)`,
      latency: `${latency}ms`,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err.message,
      hint: 'Check GCP_SERVICE_ACCOUNT_JSON',
    };
  }
}

/**
 * Test Google Cloud Storage connection
 */
async function testGCS(env) {
  const config = getGcpConfig(env);

  if (!config.bucketName) {
    return {
      status: 'warning',
      message: 'GCS bucket not configured',
      hint: 'Set GCS_BUCKET_NAME environment variable',
    };
  }

  const start = Date.now();

  try {
    const accessToken = await getGoogleAccessToken(env);

    // Try to list objects in bucket
    const url = `https://storage.googleapis.com/storage/v1/b/${config.bucketName}/o?maxResults=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      if (response.status === 404) {
        return {
          status: 'error',
          message: 'Bucket not found',
          hint: `Check bucket name: ${config.bucketName}`,
        };
      }
      if (response.status === 403) {
        return {
          status: 'error',
          message: 'Permission denied',
          hint: 'Grant roles/storage.objectAdmin to service account',
        };
      }
      return {
        status: 'error',
        message: `HTTP ${response.status}`,
      };
    }

    return {
      status: 'ok',
      message: `Bucket accessible: ${config.bucketName}`,
      latency: `${latency}ms`,
    };
  } catch (err) {
    if (err.message?.includes('GCP_SERVICE_ACCOUNT_JSON')) {
      return {
        status: 'warning',
        message: 'GCS test skipped (no service account)',
        hint: 'Configure GCP_SERVICE_ACCOUNT_JSON',
      };
    }
    return {
      status: 'error',
      message: err.message,
    };
  }
}

/**
 * Test Vectorize index (fallback for text uploads)
 */
async function testVectorize(env) {
  if (!env.VECTORIZE) {
    return {
      status: 'warning',
      message: 'Vectorize not bound (optional fallback)',
      hint: 'Vertex RAG is primary. Vectorize is optional for text-only uploads.',
    };
  }

  try {
    // Try to describe the index or do a simple query
    // Vectorize doesn't have a describe method, so we'll try a dummy query
    // Using 768 dimensions for Gemini embeddings
    const dummyVector = new Array(768).fill(0);
    const result = await env.VECTORIZE.query(dummyVector, { topK: 1 });

    return {
      status: 'ok',
      message: `Vectorize ready (fallback for text)`,
    };
  } catch (err) {
    if (err.message?.includes('not found') || err.message?.includes('does not exist')) {
      return {
        status: 'warning',
        message: 'Vectorize index not found',
        hint: 'Optional: wrangler vectorize create hkdse-physics-kb --dimensions=768 --metric=cosine',
      };
    }
    if (err.message?.includes('dimension')) {
      return {
        status: 'warning',
        message: 'Dimension mismatch (768 expected)',
        hint: 'Recreate index with --dimensions=768',
      };
    }
    return {
      status: 'warning',
      message: err.message,
    };
  }
}

/**
 * Test Gemini Embeddings API
 */
async function testOpenAI(env) {
  // Now using Gemini for embeddings instead of OpenAI
  if (!env.GEMINI_API_KEY) {
    return {
      status: 'error',
      message: 'GEMINI_API_KEY not set (used for embeddings)',
      hint: 'Set secret: wrangler pages secret put GEMINI_API_KEY',
    };
  }

  const start = Date.now();

  try {
    // Test with a minimal embedding request using Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text: 'test' }]
        },
      }),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 400 && error.error?.message?.includes('API key')) {
        return {
          status: 'error',
          message: 'Invalid API key',
          hint: 'Check your GEMINI_API_KEY',
        };
      }
      return {
        status: 'error',
        message: error.error?.message || `HTTP ${response.status}`,
      };
    }

    return {
      status: 'ok',
      message: `Embeddings working (Gemini)`,
      latency: `${latency}ms`,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err.message,
    };
  }
}

/**
 * Test R2 Storage bucket (legacy, for fallback processing)
 */
async function testR2(env) {
  if (!env.R2_BUCKET) {
    return {
      status: 'warning',
      message: 'R2 not bound (legacy)',
      hint: 'Optional legacy storage. GCS is now primary.',
    };
  }

  try {
    // Try to list objects (limit 1)
    const list = await env.R2_BUCKET.list({ limit: 1 });

    return {
      status: 'ok',
      message: `R2 accessible (legacy fallback)`,
    };
  } catch (err) {
    return {
      status: 'warning',
      message: err.message,
      hint: 'R2 is optional with Vertex RAG',
    };
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}



