/**
 * Embedding generation utilities for RAG knowledge base
 * Uses Google Gemini text-embedding-004 model
 */

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSIONS = 768; // Gemini embedding dimensions

/**
 * Generate embedding for a single text using Gemini
 * @param {string} text - Text to embed
 * @param {object} env - Environment with GEMINI_API_KEY
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function generateEmbedding(text, env) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text: text.substring(0, 8000) }] // Limit text length
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini embedding error:', error);
    throw new Error(`Failed to generate embedding: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Generate embeddings for multiple texts in batch using Gemini
 * @param {string[]} texts - Array of texts to embed
 * @param {object} env - Environment with GEMINI_API_KEY
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function generateEmbeddings(texts, env) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${env.GEMINI_API_KEY}`;

  // Gemini batch API
  const requests = texts.map(text => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: {
      parts: [{ text: text.substring(0, 8000) }]
    },
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini embedding batch error:', error);
    throw new Error(`Failed to generate embeddings: ${response.status}`);
  }

  const data = await response.json();
  return data.embeddings.map(e => e.values);
}

/**
 * Search Vectorize for similar content
 * @param {string} query - Search query
 * @param {object} env - Environment with GEMINI_API_KEY and VECTORIZE
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
