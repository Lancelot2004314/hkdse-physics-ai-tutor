/**
 * Embedding generation utilities for RAG knowledge base
 * Uses OpenAI text-embedding-3-small model
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @param {object} env - Environment with OPENAI_API_KEY
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function generateEmbedding(text, env) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000), // Limit text length
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI embedding error:', error);
    throw new Error(`Failed to generate embedding: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to embed
 * @param {object} env - Environment with OPENAI_API_KEY
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function generateEmbeddings(texts, env) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // OpenAI supports batching up to 2048 inputs
  const batchSize = 100;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map(t => t.substring(0, 8000));

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI embedding batch error:', error);
      throw new Error(`Failed to generate embeddings: ${response.status}`);
    }

    const data = await response.json();
    // Sort by index to maintain order
    const sortedEmbeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);

    allEmbeddings.push(...sortedEmbeddings);
  }

  return allEmbeddings;
}

/**
 * Search Vectorize for similar content
 * @param {string} query - Search query
 * @param {object} env - Environment with OPENAI_API_KEY and VECTORIZE
 * @param {object} options - Search options
 * @returns {Promise<object[]>} - Array of matching results
 */
export async function searchKnowledgeBase(query, env, options = {}) {
  const {
    topK = 5,
    minScore = 0.7,
    filter = {},
  } = options;

  if (!env.VECTORIZE) {
    console.warn('Vectorize not configured, skipping knowledge base search');
    return [];
  }

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query, env);

    // Search Vectorize
    const results = await env.VECTORIZE.query(queryEmbedding, {
      topK,
      returnMetadata: 'all',
      filter,
    });

    // Filter by minimum score and return
    return (results.matches || [])
      .filter(m => m.score >= minScore)
      .map(m => ({
        id: m.id,
        score: m.score,
        ...m.metadata,
      }));
  } catch (err) {
    console.error('Knowledge base search error:', err);
    return [];
  }
}

/**
 * Format search results for injection into prompts
 * @param {object[]} results - Search results
 * @returns {string} - Formatted context string
 */
export function formatKnowledgeContext(results) {
  if (!results || results.length === 0) {
    return '';
  }

  return results.map((r, i) => {
    let header = `【参考资料 ${i + 1}】`;
    if (r.year) header += ` ${r.year} DSE`;
    if (r.paper) header += ` ${r.paper}`;
    if (r.question_number) header += ` ${r.question_number}`;
    if (r.topic) header += ` [${r.topic}]`;

    return `${header}\n${r.content || ''}`;
  }).join('\n\n---\n\n');
}

/**
 * Smart text chunking for documents
 * Splits text by questions/sections while maintaining context
 * @param {string} text - Full document text
 * @param {object} options - Chunking options
 * @returns {object[]} - Array of chunks with metadata
 */
export function chunkDocument(text, options = {}) {
  const {
    maxChunkSize = 1500,
    overlap = 200,
  } = options;

  const chunks = [];

  // Try to split by question patterns first
  // Patterns: "Q.1", "Question 1", "1.", "(a)", etc.
  const questionPatterns = [
    /(?=\n\s*Q\.?\s*\d+)/gi,
    /(?=\n\s*Question\s*\d+)/gi,
    /(?=\n\s*\d+\.\s+[A-Z])/g,
    /(?=\n\s*\(\s*[a-z]\s*\))/gi,
  ];

  let sections = [text];

  // Try each pattern
  for (const pattern of questionPatterns) {
    const newSections = [];
    for (const section of sections) {
      const parts = section.split(pattern).filter(p => p.trim());
      if (parts.length > 1) {
        newSections.push(...parts);
      } else {
        newSections.push(section);
      }
    }
    if (newSections.length > sections.length) {
      sections = newSections;
    }
  }

  // Process each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    // Extract question number if present
    const qMatch = section.match(/^(?:Q\.?\s*|Question\s*)(\d+[a-z]?)/i);
    const questionNumber = qMatch ? `Q${qMatch[1]}` : null;

    // If section is too long, split further
    if (section.length > maxChunkSize) {
      const subChunks = splitBySize(section, maxChunkSize, overlap);
      subChunks.forEach((chunk, j) => {
        chunks.push({
          content: chunk,
          questionNumber: questionNumber ? `${questionNumber}-part${j + 1}` : null,
          index: chunks.length,
        });
      });
    } else {
      chunks.push({
        content: section,
        questionNumber,
        index: chunks.length,
      });
    }
  }

  return chunks;
}

/**
 * Split text by size with overlap
 */
function splitBySize(text, maxSize, overlap) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxSize;

    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + maxSize / 2) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;

    if (start < 0) start = 0;
  }

  return chunks;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
