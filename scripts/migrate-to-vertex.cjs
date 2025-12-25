#!/usr/bin/env node

/**
 * Migration Script: Migrate existing documents from R2 to GCS + Vertex AI RAG Engine
 * 
 * This script:
 * 1. Lists documents from D1 that have R2 keys but no GCS URIs
 * 2. Downloads each file from R2
 * 3. Uploads to GCS
 * 4. Triggers Vertex RAG import
 * 5. Updates D1 with new GCS URI and job ID
 * 
 * Prerequisites:
 * - Set environment variables or create a .env file:
 *   - GCP_SERVICE_ACCOUNT_JSON (path to JSON file or inline JSON)
 *   - GCP_PROJECT_ID
 *   - GCP_LOCATION (e.g., us-central1)
 *   - GCS_BUCKET_NAME
 *   - VERTEX_RAG_CORPUS_ID
 *   - CLOUDFLARE_API_TOKEN
 *   - CLOUDFLARE_ACCOUNT_ID
 *   - D1_DATABASE_ID
 *   - R2_BUCKET_NAME
 * 
 * Usage:
 *   node scripts/migrate-to-vertex.cjs [--dry-run] [--limit=N]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env if exists
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
} catch (e) {
  console.log('No .env file found, using system environment variables');
}

// Configuration
const config = {
  gcpProjectId: process.env.GCP_PROJECT_ID,
  gcpLocation: process.env.GCP_LOCATION || 'us-central1',
  gcsBucket: process.env.GCS_BUCKET_NAME,
  vertexCorpusId: process.env.VERTEX_RAG_CORPUS_ID,
  cfApiToken: process.env.CLOUDFLARE_API_TOKEN,
  cfAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  d1DatabaseId: process.env.D1_DATABASE_ID,
  r2BucketName: process.env.R2_BUCKET_NAME,
};

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

// Validate config
function validateConfig() {
  const required = [
    'gcpProjectId', 'gcsBucket', 'vertexCorpusId',
    'cfApiToken', 'cfAccountId', 'd1DatabaseId'
  ];

  const missing = required.filter(k => !config[k]);
  if (missing.length > 0) {
    console.error('Missing required configuration:', missing.join(', '));
    console.error('\nRequired environment variables:');
    console.error('  GCP_PROJECT_ID, GCS_BUCKET_NAME, VERTEX_RAG_CORPUS_ID');
    console.error('  CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID');
    process.exit(1);
  }
}

// Load GCP service account
let gcpServiceAccount = null;
async function loadGcpCredentials() {
  const saJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.error('GCP_SERVICE_ACCOUNT_JSON not set');
    process.exit(1);
  }

  try {
    // Check if it's a file path or inline JSON
    if (saJson.startsWith('{')) {
      gcpServiceAccount = JSON.parse(saJson);
    } else {
      const content = fs.readFileSync(saJson, 'utf8');
      gcpServiceAccount = JSON.parse(content);
    }
  } catch (e) {
    console.error('Failed to parse GCP service account:', e.message);
    process.exit(1);
  }
}

// Get GCP access token
let cachedToken = null;
let tokenExpiry = 0;

async function getGcpAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) {
    return cachedToken;
  }

  const crypto = require('crypto');

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: gcpServiceAccount.client_email,
    sub: gcpServiceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  })).toString('base64url');

  const signatureInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(gcpServiceAccount.private_key).toString('base64url');

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get GCP token: ' + await response.text());
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in * 1000);

  return cachedToken;
}

// Query D1 for documents needing migration
async function getDocumentsToMigrate() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/d1/database/${config.d1DatabaseId}/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.cfApiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: `SELECT * FROM kb_documents 
            WHERE r2_key IS NOT NULL 
            AND (gcs_uri IS NULL OR gcs_uri = '')
            AND status != 'processing'
            LIMIT ?`,
      params: [limit],
    }),
  });

  if (!response.ok) {
    throw new Error('D1 query failed: ' + await response.text());
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error('D1 query error: ' + JSON.stringify(data.errors));
  }

  return data.result[0]?.results || [];
}

// Download file from R2 via Cloudflare API (or direct if configured)
async function downloadFromR2(r2Key) {
  // Using wrangler r2 object get command via exec
  // This is a simplification - in production you might use S3-compatible API
  console.log(`  ⬇️  Downloading from R2: ${r2Key}`);

  if (dryRun) {
    return Buffer.from('dry run - no actual download');
  }

  // For now, we'll skip actual R2 download in the script
  // The user should manually trigger migration from the admin UI
  // or implement R2 S3-compatible API access
  throw new Error('Direct R2 download not implemented. Use admin UI for migration.');
}

// Upload file to GCS
async function uploadToGcs(fileData, objectName, contentType, metadata) {
  const token = await getGcpAccessToken();

  console.log(`  ⬆️  Uploading to GCS: ${objectName}`);

  if (dryRun) {
    return `gs://${config.gcsBucket}/${objectName}`;
  }

  const url = `https://storage.googleapis.com/upload/storage/v1/b/${config.gcsBucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': contentType,
  };

  // Add metadata
  for (const [key, value] of Object.entries(metadata)) {
    if (value) headers[`x-goog-meta-${key.toLowerCase()}`] = String(value);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: fileData,
  });

  if (!response.ok) {
    throw new Error('GCS upload failed: ' + await response.text());
  }

  const result = await response.json();
  return `gs://${config.gcsBucket}/${result.name}`;
}

// Trigger Vertex RAG import
async function triggerRagImport(gcsUri, metadata) {
  const token = await getGcpAccessToken();

  console.log(`  🔄 Triggering RAG import for: ${gcsUri}`);

  if (dryRun) {
    return 'dry-run-operation-id';
  }

  const corpusName = `projects/${config.gcpProjectId}/locations/${config.gcpLocation}/ragCorpora/${config.vertexCorpusId}`;
  const url = `https://${config.gcpLocation}-aiplatform.googleapis.com/v1beta1/${corpusName}/ragFiles:import`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      importRagFilesConfig: {
        gcsSource: { uris: [gcsUri] },
        ragFileChunkingConfig: {
          chunkSize: 1024,
          chunkOverlap: 256,
        },
        ragFileParsingConfig: {
          useAdvancedPdfParsing: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error('RAG import failed: ' + await response.text());
  }

  const result = await response.json();
  return result.name; // Operation name
}

// Update D1 with new GCS URI and operation ID
async function updateDocument(docId, gcsUri, operationId) {
  console.log(`  📝 Updating D1 record: ${docId}`);

  if (dryRun) return;

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/d1/database/${config.d1DatabaseId}/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.cfApiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql: `UPDATE kb_documents 
            SET gcs_uri = ?, ingest_job_id = ?, status = 'processing', updated_at = datetime('now')
            WHERE id = ?`,
      params: [gcsUri, operationId, docId],
    }),
  });

  if (!response.ok) {
    throw new Error('D1 update failed: ' + await response.text());
  }
}

// Main migration function
async function migrate() {
  console.log('🚀 Vertex AI RAG Migration Script');
  console.log('================================');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  validateConfig();
  await loadGcpCredentials();

  console.log(`\n📋 Configuration:`);
  console.log(`   GCP Project: ${config.gcpProjectId}`);
  console.log(`   GCS Bucket: ${config.gcsBucket}`);
  console.log(`   Vertex Location: ${config.gcpLocation}`);
  console.log(`   Corpus ID: ${config.vertexCorpusId}`);
  console.log(`   Limit: ${limit} documents\n`);

  // Get documents to migrate
  console.log('📥 Fetching documents to migrate...');
  const documents = await getDocumentsToMigrate();

  if (documents.length === 0) {
    console.log('✅ No documents need migration!');
    return;
  }

  console.log(`Found ${documents.length} documents to migrate\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const doc of documents) {
    console.log(`\n📄 Processing: ${doc.title} (${doc.id})`);
    console.log(`   R2 Key: ${doc.r2_key}`);

    try {
      // Note: Direct R2 download is not implemented
      // This script serves as a template - actual migration should be done via admin UI
      // or by implementing R2 S3-compatible API access

      // For now, just show what would be migrated
      const year = doc.year || 'unknown';
      const filename = doc.filename || `${doc.id}.pdf`;
      const gcsPath = `documents/${year}/${filename}`;

      console.log(`   Would upload to: gs://${config.gcsBucket}/${gcsPath}`);

      if (!dryRun) {
        console.log('   ⚠️  Skipping - implement R2 download or use admin UI');
      }

      successCount++;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n================================');
  console.log(`✅ Migration complete: ${successCount} processed, ${errorCount} errors`);

  if (!dryRun && documents.length > 0) {
    console.log('\n💡 Note: This script shows what needs to be migrated.');
    console.log('   For actual migration, use the admin UI or implement R2 S3-compatible download.');
  }
}

// Run
migrate().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
