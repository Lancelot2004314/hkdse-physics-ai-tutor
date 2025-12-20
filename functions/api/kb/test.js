/**
 * Knowledge Base Connection Test API
 * Tests all required services: D1, Vectorize, OpenAI, Gemini, R2
 */

import { getUserFromSession, isAdmin } from '../../../shared/auth.js';

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
      vectorize: await testVectorize(env),
      openai: await testOpenAI(env),
      gemini: await testGemini(env),
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
 * Test Vectorize index
 */
async function testVectorize(env) {
  if (!env.VECTORIZE) {
    return {
      status: 'error',
      message: 'Vectorize not bound',
      hint: 'Check wrangler.toml [[vectorize]] binding and create index in Cloudflare Dashboard',
    };
  }

  try {
    // Try to describe the index or do a simple query
    // Vectorize doesn't have a describe method, so we'll try a dummy query
    const dummyVector = new Array(1536).fill(0);
    const result = await env.VECTORIZE.query(dummyVector, { topK: 1 });

    return {
      status: 'ok',
      message: `Index ready (${result.matches?.length || 0} test matches)`,
    };
  } catch (err) {
    if (err.message?.includes('not found') || err.message?.includes('does not exist')) {
      return {
        status: 'error',
        message: 'Vectorize index not found',
        hint: 'Create index: wrangler vectorize create hkdse-physics-kb --dimensions=1536 --metric=cosine',
      };
    }
    return {
      status: 'error',
      message: err.message,
    };
  }
}

/**
 * Test OpenAI API (for embeddings)
 */
async function testOpenAI(env) {
  if (!env.OPENAI_API_KEY) {
    return {
      status: 'error',
      message: 'OPENAI_API_KEY not set',
      hint: 'Set secret: wrangler pages secret put OPENAI_API_KEY',
    };
  }

  const start = Date.now();

  try {
    // Test with a minimal embedding request
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'test',
      }),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) {
        return {
          status: 'error',
          message: 'Invalid API key',
          hint: 'Check your OPENAI_API_KEY',
        };
      }
      if (response.status === 429) {
        return {
          status: 'warning',
          message: 'Rate limited',
          hint: 'API key works but rate limited',
        };
      }
      return {
        status: 'error',
        message: error.error?.message || `HTTP ${response.status}`,
      };
    }

    return {
      status: 'ok',
      message: `Embeddings working`,
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
 * Test Gemini API (for OCR)
 */
async function testGemini(env) {
  if (!env.GEMINI_API_KEY) {
    return {
      status: 'warning',
      message: 'GEMINI_API_KEY not set',
      hint: 'Optional for PDF OCR. Set secret: wrangler pages secret put GEMINI_API_KEY',
    };
  }

  const start = Date.now();

  try {
    // Test with a simple text generation request
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "ok" only' }] }],
        generationConfig: { maxOutputTokens: 10 },
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
      message: 'OCR ready (Gemini)',
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
 * Test R2 Storage bucket
 */
async function testR2(env) {
  if (!env.R2_BUCKET) {
    return {
      status: 'warning',
      message: 'R2_BUCKET not bound',
      hint: 'Optional for file storage. Check wrangler.toml [[r2_buckets]] binding',
    };
  }

  try {
    // Try to list objects (limit 1)
    const list = await env.R2_BUCKET.list({ limit: 1 });

    return {
      status: 'ok',
      message: `Bucket accessible (${list.objects?.length || 0}+ files)`,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err.message,
      hint: 'Check R2 bucket permissions',
    };
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
