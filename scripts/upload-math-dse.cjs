/**
 * Upload HKDSE Mathematics DSE Past Papers
 * Handles the complex folder structure from downloaded papers
 * 
 * Usage:
 *   COOKIE="session=xxx" node scripts/upload-math-dse.cjs
 * 
 * This script will scan the Math DSE folder and upload all PDFs with correct metadata.
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://hkdse-physics-ai-tutor.pages.dev';
const DELAY_BETWEEN_UPLOADS = 45000; // 45 seconds between uploads (Vertex RAG Engine needs time to process)

// Source folder
const SOURCE_FOLDER = '/Users/lance/Downloads/maths dse';

// Get session cookie from environment
const SESSION_COOKIE = process.env.COOKIE;

if (!SESSION_COOKIE) {
  console.error('❌ Error: COOKIE environment variable is required');
  console.error('');
  console.error('Usage: COOKIE="session=xxx" node scripts/upload-math-dse.cjs');
  process.exit(1);
}

/**
 * Recursively find all PDF files in a directory
 */
function findAllPDFs(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip "解密版" folders (password removed duplicates)
      if (!file.includes('解密版')) {
        findAllPDFs(filePath, fileList);
      }
    } else if (file.toLowerCase().endsWith('.pdf')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

/**
 * Extract metadata from file path and name
 */
function extractMetadata(filePath) {
  const filename = path.basename(filePath);
  const dirPath = path.dirname(filePath);
  const lowerFilename = filename.toLowerCase();
  const lowerPath = filePath.toLowerCase();

  const metadata = {
    year: null,
    paper: null,
    docType: 'Past Paper',
    language: 'zh', // Default
    subject: 'Mathematics',
    title: null,
    module: null, // null for compulsory, 'M1' or 'M2' for extended
  };

  // Detect language from folder path
  if (lowerPath.includes('(英)') || lowerPath.includes('（英）') || 
      lowerPath.includes('-英-') || lowerPath.includes('英-') ||
      lowerPath.includes('(eng)')) {
    metadata.language = 'en';
  } else if (lowerPath.includes('(中)') || lowerPath.includes('（中）') || 
             lowerPath.includes('-中-') || lowerPath.includes('中）') ||
             lowerPath.includes('-c-') || lowerPath.includes('中文')) {
    metadata.language = 'zh';
  }
  
  // Also check filename for language hints
  if (lowerFilename.includes('-e-') || lowerFilename.includes('_e_') ||
      /\d{4}(pp|ans)\.pdf$/i.test(filename)) {
    // English folder uses patterns like "2012pp.pdf", "2012ans.pdf"
    if (lowerPath.includes('（英）') || lowerPath.includes('(英)')) {
      metadata.language = 'en';
    }
  }

  // Detect module (M1, M2, or compulsory)
  if (lowerPath.includes('m1') || lowerPath.includes('單元一') || 
      lowerPath.includes('单元1') || lowerPath.includes('epm1')) {
    metadata.module = 'M1';
  } else if (lowerPath.includes('m2') || lowerPath.includes('單元二') || 
             lowerPath.includes('单元2') || lowerPath.includes('epm2')) {
    metadata.module = 'M2';
  }

  // Extract year (4 digits, 2012-2030)
  const yearMatch = filename.match(/\b(20[1-3]\d)\b/);
  if (yearMatch) {
    metadata.year = yearMatch[1];
  } else if (lowerFilename.includes('sample') || lowerFilename.includes('sp-')) {
    metadata.year = 'Sample';
  } else if (lowerFilename.includes('practice') || lowerFilename.includes('pp-dse')) {
    metadata.year = 'Practice';
  }

  // Detect document type (Past Paper or Marking Scheme)
  if (lowerFilename.includes('ans') || lowerFilename.includes('-ms') || 
      lowerFilename.includes('_ms') || lowerFilename.includes('marking')) {
    metadata.docType = 'Marking Scheme';
  } else if (lowerFilename.includes('sample') && lowerFilename.includes('level')) {
    // Sample papers with level indicators are example answers
    metadata.docType = 'Sample Answer';
  }

  // Detect paper number for compulsory part
  if (!metadata.module) {
    if (lowerFilename.includes('p1') || lowerFilename.includes('卷一') || 
        lowerFilename.includes('(卷一)') || lowerFilename.includes('paper1')) {
      metadata.paper = 'Paper 1';
    } else if (lowerFilename.includes('p2') || lowerFilename.includes('卷二') || 
               lowerFilename.includes('(卷二)') || lowerFilename.includes('paper2')) {
      metadata.paper = 'Paper 2';
    } else if (metadata.docType === 'Marking Scheme') {
      // Marking schemes often don't specify paper number
      metadata.paper = 'All Papers';
    }
  }

  // Generate smart title
  const parts = [];
  if (metadata.year) parts.push(metadata.year);
  parts.push('DSE Mathematics');
  if (metadata.module) {
    parts.push(metadata.module);
  } else if (metadata.paper) {
    parts.push(metadata.paper);
  }
  if (metadata.docType !== 'Past Paper') {
    parts.push(`(${metadata.docType})`);
  }
  if (metadata.language === 'en') {
    parts.push('[EN]');
  }

  metadata.title = parts.join(' ');

  return metadata;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadFile(filePath, metadata) {
  const filename = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  
  // Use FormData from form-data package (works with Node.js fetch)
  const FormData = require('form-data');
  const formData = new FormData();
  
  formData.append('file', fileBuffer, {
    filename: filename,
    contentType: 'application/pdf',
  });
  formData.append('title', metadata.title);
  formData.append('year', metadata.year || '');
  formData.append('paper', metadata.paper || metadata.module || '');
  formData.append('language', metadata.language);
  formData.append('subject', metadata.subject);
  formData.append('docType', metadata.docType);
  formData.append('source', 'DSE');

  // Convert FormData to buffer for native fetch compatibility
  const formBuffer = formData.getBuffer();
  const formHeaders = formData.getHeaders();

  const response = await fetch(`${API_BASE}/api/kb/upload`, {
    method: 'POST',
    headers: {
      'Cookie': SESSION_COOKIE,
      ...formHeaders,
    },
    body: formBuffer,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

async function main() {
  console.log('');
  console.log('🚀 HKDSE Mathematics Past Paper Upload Script');
  console.log('='.repeat(50));
  console.log(`📁 Source: ${SOURCE_FOLDER}`);
  console.log('');

  // Find all PDF files
  console.log('🔍 Scanning for PDF files...');
  const allPDFs = findAllPDFs(SOURCE_FOLDER);
  
  if (allPDFs.length === 0) {
    console.error('❌ No PDF files found');
    process.exit(1);
  }

  console.log(`📄 Found ${allPDFs.length} PDF files`);
  console.log('');

  // Preview first 10 files with extracted metadata
  console.log('📋 Preview (first 10 files):');
  console.log('-'.repeat(50));
  for (let i = 0; i < Math.min(10, allPDFs.length); i++) {
    const meta = extractMetadata(allPDFs[i]);
    const shortPath = allPDFs[i].replace(SOURCE_FOLDER, '...');
    console.log(`  ${shortPath}`);
    console.log(`    → ${meta.title} | ${meta.language.toUpperCase()} | ${meta.docType}`);
  }
  if (allPDFs.length > 10) {
    console.log(`  ... and ${allPDFs.length - 10} more files`);
  }
  console.log('');

  // Ask for confirmation (in non-interactive mode, just proceed)
  console.log('⏳ Starting upload in 5 seconds... (Ctrl+C to cancel)');
  await sleep(5000);

  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < allPDFs.length; i++) {
    const filePath = allPDFs[i];
    const filename = path.basename(filePath);
    const metadata = extractMetadata(filePath);

    process.stdout.write(`[${i + 1}/${allPDFs.length}] ${filename} ... `);

    try {
      const result = await uploadFile(filePath, metadata);
      console.log(`✅ ${result.status || 'OK'}`);
      results.success++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      results.failed++;
      results.errors.push({ filename, error: err.message });
    }

    // Delay between uploads
    if (i < allPDFs.length - 1) {
      await sleep(DELAY_BETWEEN_UPLOADS);
    }
  }

  // Print summary
  console.log('');
  console.log('='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('');
    console.log('Failed uploads:');
    results.errors.slice(0, 20).forEach(e => {
      console.log(`  - ${e.filename}: ${e.error}`);
    });
    if (results.errors.length > 20) {
      console.log(`  ... and ${results.errors.length - 20} more errors`);
    }
  }

  console.log('');
  console.log('🎉 Upload complete!');
  console.log('');
  console.log('⚠️  Note: Files are now being processed by Vertex AI RAG Engine.');
  console.log('   Check /admin-kb for processing status.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

