/**
 * Vertex AI RAG Engine API Wrapper
 * Handles GCS upload, RAG document import, and retrieval
 */

import { getGoogleAccessToken, getGcpConfig } from './googleAuth.js';

/**
 * Upload file to Google Cloud Storage
 * @param {object} env - Environment variables
 * @param {Uint8Array|ArrayBuffer} fileData - File binary data
 * @param {string} objectName - GCS object path (e.g., "documents/2024/physics-paper.pdf")
 * @param {string} contentType - MIME type
 * @param {object} metadata - Custom metadata
 * @returns {Promise<string>} - GCS URI (gs://bucket/path)
 */
export async function uploadToGcs(env, fileData, objectName, contentType, metadata = {}) {
  const accessToken = await getGoogleAccessToken(env);
  const config = getGcpConfig(env);

  if (!config.bucketName) {
    throw new Error('GCS_BUCKET_NAME not configured');
  }

  // Convert metadata to x-goog-meta-* headers
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': contentType,
    'Content-Length': fileData.byteLength || fileData.length,
  };

  // Add custom metadata as headers
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null) {
      headers[`x-goog-meta-${key.toLowerCase()}`] = String(value);
    }
  }

  const url = `https://storage.googleapis.com/upload/storage/v1/b/${config.bucketName}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: fileData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GCS upload failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return `gs://${config.bucketName}/${result.name}`;
}

/**
 * Import document into Vertex RAG Engine corpus
 * @param {object} env - Environment variables
 * @param {string} gcsUri - GCS URI of the document
 * @param {object} docMetadata - Document metadata for RAG
 * @param {object} options - Import options
 * @returns {Promise<object>} - Import operation details
 */
export async function ragImportDocument(env, gcsUri, docMetadata = {}, options = {}) {
  const accessToken = await getGoogleAccessToken(env);
  const config = getGcpConfig(env);

  if (!config.corpusId) {
    throw new Error('VERTEX_RAG_CORPUS_ID not configured');
  }

  const corpusName = `projects/${config.projectId}/locations/${config.location}/ragCorpora/${config.corpusId}`;
  const url = `https://${config.location}-aiplatform.googleapis.com/v1beta1/${corpusName}/ragFiles:import`;

  // Build import request
  const importConfig = {
    ragFileChunkingConfig: {
      chunkSize: options.chunkSize || 1024,
      chunkOverlap: options.chunkOverlap || 256,
    },
  };

  // Enable Document AI layout parser if specified
  if (options.useLayoutParser !== false) {
    // Use Document AI Layout Parser processor
    // Note: Processor is in US region, works cross-region with RAG corpus
    const processorName = env.DOCAI_PROCESSOR_NAME || 'projects/592057617160/locations/us/processors/107fa4a0623d5caf';
    importConfig.ragFileParsingConfig = {
      layoutParser: {
        processorName: processorName,
      },
    };
  }

  const requestBody = {
    importRagFilesConfig: {
      gcsSource: {
        uris: [gcsUri],
      },
      ragFileChunkingConfig: importConfig.ragFileChunkingConfig,
    },
  };

  // Add parsing config if using layout parser
  if (importConfig.ragFileParsingConfig) {
    requestBody.importRagFilesConfig.ragFileParsingConfig = importConfig.ragFileParsingConfig;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RAG import failed: ${response.status} - ${error}`);
  }

  const result = await response.json();

  // Return operation info for tracking
  return {
    operationName: result.name,
    gcsUri,
    metadata: docMetadata,
  };
}

/**
 * Check RAG import operation status
 * @param {object} env - Environment variables
 * @param {string} operationName - Full operation name
 * @returns {Promise<object>} - Operation status
 */
export async function checkImportStatus(env, operationName) {
  const accessToken = await getGoogleAccessToken(env);
  const config = getGcpConfig(env);

  const url = `https://${config.location}-aiplatform.googleapis.com/v1beta1/${operationName}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to check operation status: ${response.status} - ${error}`);
  }

  const result = await response.json();

  return {
    done: result.done || false,
    error: result.error,
    response: result.response,
    metadata: result.metadata,
  };
}

/**
 * Retrieve relevant chunks from RAG corpus
 * @param {object} env - Environment variables
 * @param {string} query - Search query
 * @param {object} filters - Metadata filters
 * @param {number} topK - Number of results (default 5)
 * @returns {Promise<Array>} - Retrieved chunks with content and metadata
 */
export async function ragRetrieve(env, query, filters = {}, topK = 5) {
  const accessToken = await getGoogleAccessToken(env);
  const config = getGcpConfig(env);

  if (!config.corpusId) {
    throw new Error('VERTEX_RAG_CORPUS_ID not configured');
  }

  const corpusName = `projects/${config.projectId}/locations/${config.location}/ragCorpora/${config.corpusId}`;

  // Use the location-level retrieveContexts endpoint (not corpus-level)
  const url = `https://${config.location}-aiplatform.googleapis.com/v1beta1/projects/${config.projectId}/locations/${config.location}:retrieveContexts`;

  // Build retrieval request with proper structure
  const requestBody = {
    vertexRagStore: {
      ragCorpora: [corpusName],
    },
    query: {
      text: query,
    },
  };

  // Note: similarityTopK goes in ragRetrievalConfig, not query
  // But the simple endpoint doesn't always support it, so we'll handle filtering in post-processing

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RAG retrieval failed: ${response.status} - ${error}`);
  }

  const result = await response.json();

  // Parse contexts into unified format
  const contexts = result.contexts?.contexts || [];

  // Map to unified format and apply topK/minSimilarity filtering
  let results = contexts.map(ctx => ({
    text: ctx.text || ctx.chunk?.text || '',
    sourceUri: ctx.sourceUri || '',
    score: ctx.score || ctx.distance || 0,
    metadata: parseGcsMetadata(ctx),
  }));

  // Note: Vertex AI RAG returns distance scores (lower = more similar)
  // Don't filter here - let the API handle relevance ranking
  // The scores are typically 0.3-0.5 for relevant results

  // Limit to topK results
  return results.slice(0, topK);
}

/**
 * List RAG files in corpus
 * @param {object} env - Environment variables
 * @param {number} pageSize - Results per page
 * @param {string} pageToken - Pagination token
 * @returns {Promise<object>} - Files list with pagination
 */
export async function listRagFiles(env, pageSize = 100, pageToken = null) {
  const accessToken = await getGoogleAccessToken(env);
  const config = getGcpConfig(env);

  if (!config.corpusId) {
    throw new Error('VERTEX_RAG_CORPUS_ID not configured');
  }

  const corpusName = `projects/${config.projectId}/locations/${config.location}/ragCorpora/${config.corpusId}`;
  let url = `https://${config.location}-aiplatform.googleapis.com/v1beta1/${corpusName}/ragFiles?pageSize=${pageSize}`;

  if (pageToken) {
    url += `&pageToken=${encodeURIComponent(pageToken)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list RAG files: ${response.status} - ${error}`);
  }

  const result = await response.json();

  return {
    files: (result.ragFiles || []).map(file => ({
      name: file.name,
      displayName: file.displayName,
      sizeBytes: file.sizeBytes,
      createTime: file.createTime,
      updateTime: file.updateTime,
      ragFileType: file.ragFileType,
      gcsUri: file.gcsSource?.uris?.[0],
    })),
    nextPageToken: result.nextPageToken,
  };
}

/**
 * Delete RAG file from corpus
 * @param {object} env - Environment variables
 * @param {string} ragFileName - Full RAG file resource name
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteRagFile(env, ragFileName) {
  const accessToken = await getGoogleAccessToken(env);
  const config = getGcpConfig(env);

  const url = `https://${config.location}-aiplatform.googleapis.com/v1beta1/${ragFileName}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete RAG file: ${response.status} - ${error}`);
  }

  return true;
}

/**
 * Parse GCS metadata from retrieval context
 */
function parseGcsMetadata(context) {
  // Extract metadata from source URI or context
  const metadata = {};

  if (context.sourceUri) {
    // Try to extract info from GCS path
    const pathMatch = context.sourceUri.match(/gs:\/\/[^/]+\/(.+)/);
    if (pathMatch) {
      const path = pathMatch[1];
      // Extract year if present in path
      const yearMatch = path.match(/(\d{4})/);
      if (yearMatch) {
        metadata.year = yearMatch[1];
      }
    }
  }

  return metadata;
}

/**
 * Format retrieved chunks for prompt injection
 * @param {Array} chunks - Retrieved chunks from ragRetrieve
 * @returns {string} - Formatted context string
 */
export function formatRetrievedContext(chunks) {
  if (!chunks || chunks.length === 0) {
    return '';
  }

  const contextParts = chunks.map((chunk, index) => {
    const source = chunk.sourceUri ? `[Source: ${chunk.sourceUri.split('/').pop()}]` : '';
    return `--- Example ${index + 1} ${source} ---\n${chunk.text}`;
  });

  return contextParts.join('\n\n');
}

/**
 * Check if Vertex RAG is properly configured
 * @param {object} env - Environment variables
 * @returns {object} - Configuration status
 */
export function checkVertexConfig(env) {
  const config = getGcpConfig(env);

  const issues = [];

  if (!env.GCP_SERVICE_ACCOUNT_JSON) {
    issues.push('Missing GCP_SERVICE_ACCOUNT_JSON');
  }
  if (!config.projectId) {
    issues.push('Missing GCP_PROJECT_ID');
  }
  if (!config.bucketName) {
    issues.push('Missing GCS_BUCKET_NAME');
  }
  if (!config.corpusId) {
    issues.push('Missing VERTEX_RAG_CORPUS_ID');
  }

  return {
    configured: issues.length === 0,
    issues,
    config: {
      projectId: config.projectId || '(not set)',
      location: config.location,
      bucketName: config.bucketName || '(not set)',
      corpusId: config.corpusId || '(not set)',
    },
  };
}
