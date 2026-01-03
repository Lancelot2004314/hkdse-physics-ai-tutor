/**
 * Batch Upload Script for HKDSE Mathematics Past Papers
 * Uploads PDF files to the knowledge base with correct metadata
 * 
 * Usage:
 *   COOKIE="session=xxx" FOLDER="/path/to/math/papers" node scripts/batch-upload-math.cjs
 * 
 * File naming convention (for automatic metadata detection):
 *   - 2023-math-1.pdf → Year: 2023, Paper: Paper 1, Doc Type: Past Paper
 *   - 2023-math-2.pdf → Year: 2023, Paper: Paper 2, Doc Type: Past Paper
 *   - 2023-math-1-ms.pdf → Year: 2023, Paper: Paper 1, Doc Type: Marking Scheme
 *   - 2023-math-2-ans.pdf → Year: 2023, Paper: Paper 2, Doc Type: Marking Scheme
 * 
 * Get your session cookie from browser DevTools:
 *   1. Go to https://hkdse-physics-ai-tutor.pages.dev/admin-kb
 *   2. Open DevTools > Application > Cookies
 *   3. Copy the value of the "session" cookie
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE = 'https://hkdse-physics-ai-tutor.pages.dev';
const DELAY_BETWEEN_UPLOADS = 5000; // 5 seconds between uploads

// Get configuration from environment
const SESSION_COOKIE = process.env.COOKIE;
const FOLDER_PATH = process.env.FOLDER;

if (!SESSION_COOKIE) {
  console.error('❌ Error: COOKIE environment variable is required');
  console.error('');
  console.error('Usage: COOKIE="session=xxx" FOLDER="/path/to/math/papers" node scripts/batch-upload-math.cjs');
  process.exit(1);
}

if (!FOLDER_PATH) {
  console.error('❌ Error: FOLDER environment variable is required');
  console.error('');
  console.error('Usage: COOKIE="session=xxx" FOLDER="/path/to/math/papers" node scripts/batch-upload-math.cjs');
  process.exit(1);
}

if (!fs.existsSync(FOLDER_PATH)) {
  console.error(`❌ Error: Folder does not exist: ${FOLDER_PATH}`);
  process.exit(1);
}

/**
 * Extract metadata from filename
 * Supports patterns like:
 *   - 2023-math-1.pdf → Year: 2023, Paper: Paper 1, Doc Type: Past Paper
 *   - 2023-math-2-ms.pdf → Year: 2023, Paper: Paper 2, Doc Type: Marking Scheme
 *   - dse-math-2022-paper1.pdf → Year: 2022, Paper: Paper 1
 *   - 2023_數學_試卷一.pdf → Year: 2023, Paper: Paper 1
 */
function extractMetadata(filename) {
  const lowerFilename = filename.toLowerCase();
  const baseName = filename.replace(/\.[^/.]+$/, ''); // Remove extension

  const metadata = {
    year: null,
    paper: null,
    docType: 'Past Paper',
    language: 'zh', // Default to Chinese for Math
    subject: 'Mathematics',
    title: null,
  };

  // Extract year (4 digits, 2012-2030)
  const yearMatch = filename.match(/\b(20[1-3]\d)\b/);
  if (yearMatch) {
    metadata.year = yearMatch[1];
  }

  // Detect document type
  if (lowerFilename.includes('ms') || lowerFilename.includes('marking') || 
      lowerFilename.includes('answer') || lowerFilename.includes('ans') ||
      lowerFilename.includes('評分') || lowerFilename.includes('答案')) {
    metadata.docType = 'Marking Scheme';
  } else if (lowerFilename.includes('sample') || lowerFilename.includes('practice') ||
             lowerFilename.includes('練習')) {
    metadata.docType = 'Practice Paper';
  }

  // Detect paper number
  const paperPatterns = [
    /(?:math|paper|試卷)[_\-\s]?(1a?|1b?|2)/i,
    /[_\-](1a?|1b?|2)(?:[_.\s\-]|$)/i,
    /\b(paper)\s*(1a?|1b?|2)\b/i,
    /試卷([一二])/i,
  ];

  for (const pattern of paperPatterns) {
    const match = lowerFilename.match(pattern);
    if (match) {
      let paperNum = match[1] || match[2];
      // Convert Chinese numbers
      if (paperNum === '一') paperNum = '1';
      if (paperNum === '二') paperNum = '2';
      metadata.paper = `Paper ${paperNum.toUpperCase()}`;
      break;
    }
  }

  // Detect language
  if (lowerFilename.includes('eng') || /[a-z]{5,}/.test(baseName)) {
    metadata.language = 'en';
  }

  // Generate smart title
  const parts = [];
  if (metadata.year) parts.push(metadata.year);
  parts.push('Mathematics');
  if (metadata.paper) parts.push(metadata.paper);
  if (metadata.docType !== 'Past Paper') parts.push(metadata.docType);

  metadata.title = parts.join(' ');

  return metadata;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadFile(filePath, metadata) {
  const filename = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  
  // Create form data
  const formData = new FormData();
  formData.append('file', fileBuffer, {
    filename: filename,
    contentType: 'application/pdf',
  });
  formData.append('title', metadata.title);
  formData.append('year', metadata.year || '');
  formData.append('paper', metadata.paper || '');
  formData.append('language', metadata.language);
  formData.append('subject', metadata.subject);
  formData.append('docType', metadata.docType);
  formData.append('source', 'DSE');

  const response = await fetch(`${API_BASE}/api/kb/upload`, {
    method: 'POST',
    headers: {
      'Cookie': SESSION_COOKIE,
      ...formData.getHeaders(),
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

async function main() {
  // Get all PDF files in the folder
  const files = fs.readdirSync(FOLDER_PATH)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(FOLDER_PATH, f));

  if (files.length === 0) {
    console.error('❌ No PDF files found in the folder');
    process.exit(1);
  }

  console.log('');
  console.log('🚀 Batch Upload Script - HKDSE Mathematics');
  console.log('==========================================');
  console.log(`📁 Folder: ${FOLDER_PATH}`);
  console.log(`📄 PDF files found: ${files.length}`);
  console.log('');

  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const filename = path.basename(filePath);
    const metadata = extractMetadata(filename);

    process.stdout.write(`[${i + 1}/${files.length}] ${filename} ... `);

    try {
      const result = await uploadFile(filePath, metadata);
      console.log(`✅ ${result.status} (${metadata.title})`);
      results.success++;
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      results.failed++;
      results.errors.push({ filename, error: err.message });
    }

    // Delay between uploads
    if (i < files.length - 1) {
      await sleep(DELAY_BETWEEN_UPLOADS);
    }
  }

  // Print summary
  console.log('');
  console.log('==========================================');
  console.log('📊 Summary');
  console.log('==========================================');
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('');
    console.log('Failed uploads:');
    results.errors.forEach(e => {
      console.log(`  - ${e.filename}: ${e.error}`);
    });
  }

  console.log('');
  console.log('🎉 Batch upload complete!');
  console.log('');
  console.log('⚠️  Note: Files are now being processed by Vertex AI RAG Engine.');
  console.log('   Check /admin-kb for processing status.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

