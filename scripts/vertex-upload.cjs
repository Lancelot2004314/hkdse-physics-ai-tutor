#!/usr/bin/env node

/**
 * Vertex AI Bulk Upload Script
 * Upload local PDF/image files directly to GCS + Vertex AI RAG Engine
 * 
 * Prerequisites:
 * - Create a .env file with:
 *   GCP_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
 *   GCP_PROJECT_ID=your-project-id
 *   GCP_LOCATION=us-central1
 *   GCS_BUCKET_NAME=your-bucket-name
 *   VERTEX_RAG_CORPUS_ID=your-corpus-id
 * 
 * Usage:
 *   node scripts/vertex-upload.cjs <path-to-file-or-directory> [options]
 * 
 * Options:
 *   --lang=en|zh       Language (default: en)
 *   --subject=Physics  Subject (default: Physics)
 *   --dry-run          Show what would be uploaded without uploading
 * 
 * Examples:
 *   node scripts/vertex-upload.cjs ./papers/2023/ --lang=en
 *   node scripts/vertex-upload.cjs ./papers/2023-physics-1a.pdf --lang=zh
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
} catch (e) {
  // Ignore
}

// Parse arguments
const args = process.argv.slice(2);
const inputPath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const langArg = args.find(a => a.startsWith('--lang='));
const subjectArg = args.find(a => a.startsWith('--subject='));

const options = {
  lang: langArg ? langArg.split('=')[1] : 'en',
  subject: subjectArg ? subjectArg.split('=')[1] : 'Physics',
};

if (!inputPath) {
  console.log('Usage: node scripts/vertex-upload.cjs <path-to-file-or-directory> [options]');
  console.log('\nOptions:');
  console.log('  --lang=en|zh       Language (default: en)');
  console.log('  --subject=Physics  Subject (default: Physics)');
  console.log('  --dry-run          Show what would be uploaded');
  process.exit(1);
}

// Configuration
const config = {
  projectId: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION || 'us-central1',
  bucketName: process.env.GCS_BUCKET_NAME,
  corpusId: process.env.VERTEX_RAG_CORPUS_ID,
};

// Load service account
let serviceAccount = null;

function loadServiceAccount() {
  const saJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.error('Error: GCP_SERVICE_ACCOUNT_JSON not set');
    process.exit(1);
  }

  try {
    if (saJson.startsWith('{')) {
      serviceAccount = JSON.parse(saJson);
    } else {
      serviceAccount = JSON.parse(fs.readFileSync(saJson, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load service account:', e.message);
    process.exit(1);
  }
}

// Get access token
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) {
    return cachedToken;
  }

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  })).toString('base64url');

  const signatureInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key).toString('base64url');

  const jwt = `${signatureInput}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get token: ' + await response.text());
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in * 1000);

  return cachedToken;
}

// Detect document type from filename
function detectDocType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('ms') || lower.includes('marking') || lower.includes('ans')) {
    return 'Marking Scheme';
  }
  if (lower.includes('candidate') || lower.includes('performance')) {
    return 'Candidate Performance';
  }
  if (lower.includes('sample')) {
    return 'Sample Paper';
  }
  return 'Past Paper';
}

// Extract year from filename
function extractYear(fileName) {
  const match = fileName.match(/(20\d{2})/);
  return match ? match[1] : null;
}

// Extract paper type from filename
function extractPaper(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('1a') || lower.includes('paper1a') || lower.includes('p1a')) return 'Paper 1A';
  if (lower.includes('1b') || lower.includes('paper1b') || lower.includes('p1b')) return 'Paper 1B';
  if (lower.includes('2') && (lower.includes('paper') || lower.includes('p2'))) return 'Paper 2';
  if (lower.includes('ms') || lower.includes('marking')) return 'Marking Scheme';
  return null;
}

// Get MIME type
function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const types = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return types[ext] || 'application/octet-stream';
}

// Upload to GCS
async function uploadToGcs(filePath, gcsPath, metadata) {
  const token = await getAccessToken();
  const fileData = fs.readFileSync(filePath);
  const mimeType = getMimeType(filePath);

  console.log(`  ⬆️  Uploading to GCS: ${gcsPath}`);

  if (dryRun) {
    return `gs://${config.bucketName}/${gcsPath}`;
  }

  const url = `https://storage.googleapis.com/upload/storage/v1/b/${config.bucketName}/o?uploadType=media&name=${encodeURIComponent(gcsPath)}`;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': mimeType,
  };

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
  return `gs://${config.bucketName}/${result.name}`;
}

// Trigger RAG import
async function triggerRagImport(gcsUri) {
  const token = await getAccessToken();

  console.log(`  🔄 Triggering RAG import...`);

  if (dryRun) {
    return 'dry-run-operation';
  }

  const corpusName = `projects/${config.projectId}/locations/${config.location}/ragCorpora/${config.corpusId}`;
  const url = `https://${config.location}-aiplatform.googleapis.com/v1beta1/${corpusName}/ragFiles:import`;

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
    const error = await response.text();
    throw new Error('RAG import failed: ' + error);
  }

  const result = await response.json();
  return result.name;
}

// Process a single file
async function processFile(filePath) {
  const fileName = path.basename(filePath);
  const year = extractYear(fileName) || 'unknown';
  const docType = detectDocType(fileName);
  const paper = extractPaper(fileName);

  console.log(`\n📄 ${fileName}`);
  console.log(`   Year: ${year}, Type: ${docType}, Paper: ${paper || 'N/A'}`);

  const gcsPath = `documents/${year}/${fileName}`;
  const metadata = {
    title: path.basename(fileName, path.extname(fileName)),
    year,
    docType,
    paper: paper || '',
    language: options.lang,
    subject: options.subject,
  };

  try {
    const gcsUri = await uploadToGcs(filePath, gcsPath, metadata);
    console.log(`   ✅ GCS: ${gcsUri}`);

    const operationId = await triggerRagImport(gcsUri);
    console.log(`   ✅ RAG Import started: ${operationId.split('/').pop()}`);

    return true;
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return false;
  }
}

// Main
async function main() {
  console.log('🚀 Vertex AI Bulk Upload');
  console.log('========================');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE\n');
  }

  // Validate config
  const missing = ['projectId', 'bucketName', 'corpusId'].filter(k => !config[k]);
  if (missing.length > 0) {
    console.error('Missing configuration:', missing.join(', '));
    console.error('Set in .env: GCP_PROJECT_ID, GCS_BUCKET_NAME, VERTEX_RAG_CORPUS_ID');
    process.exit(1);
  }

  loadServiceAccount();

  console.log(`Project: ${config.projectId}`);
  console.log(`Bucket: ${config.bucketName}`);
  console.log(`Corpus: ${config.corpusId}`);
  console.log(`Language: ${options.lang}`);
  console.log(`Subject: ${options.subject}`);

  // Get files to process
  const resolvedPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Path not found: ${resolvedPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(resolvedPath);
  let files = [];

  if (stats.isDirectory()) {
    const entries = fs.readdirSync(resolvedPath);
    files = entries
      .filter(f => /\.(pdf|png|jpg|jpeg|webp)$/i.test(f))
      .map(f => path.join(resolvedPath, f));
  } else {
    files = [resolvedPath];
  }

  if (files.length === 0) {
    console.log('\nNo PDF/image files found.');
    process.exit(0);
  }

  console.log(`\nFound ${files.length} files to upload`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const success = await processFile(file);
    if (success) successCount++;
    else errorCount++;

    // Small delay between uploads
    if (!dryRun) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n========================');
  console.log(`✅ Complete: ${successCount} uploaded, ${errorCount} errors`);

  if (!dryRun && successCount > 0) {
    console.log('\n💡 Documents are now being processed by Vertex AI.');
    console.log('   Check status in admin-kb or via Vertex AI console.');
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
