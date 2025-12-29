/**
 * Batch Pre-generation Script
 * Generates 1 question for every subtopic x language x question type combination
 * 
 * Usage:
 *   COOKIE="session=xxx" node scripts/batch-pregen.cjs
 * 
 * Get your session cookie from browser DevTools:
 *   1. Go to https://hkdse-physics-ai-tutor.pages.dev/admin-pool
 *   2. Open DevTools > Application > Cookies
 *   3. Copy the value of the "session" cookie
 */

const API_BASE = 'https://hkdse-physics-ai-tutor.pages.dev';
const DELAY_BETWEEN_CALLS = 3000; // 3 seconds between API calls

// All subtopics from shared/topics.js
const SUBTOPICS = [
  // Heat and Gases
  'heat_1', 'heat_2', 'heat_3', 'heat_4',
  // Force and Motion
  'mech_1', 'mech_2', 'mech_3', 'mech_4', 'mech_5', 'mech_6',
  // Waves
  'wave_1', 'wave_2', 'wave_3',
  // Electricity and Magnetism
  'elec_1', 'elec_2', 'elec_3', 'elec_4',
  // Radioactivity and Nuclear Energy
  'radio_1', 'radio_2', 'radio_3',
  // Astronomy and Space Science
  'astro_1', 'astro_2', 'astro_3',
];

const LANGUAGES = ['zh', 'en'];
const QTYPES = ['mc', 'short', 'long'];

// Get session cookie from environment
const SESSION_COOKIE = process.env.COOKIE;

if (!SESSION_COOKIE) {
  console.error('❌ Error: COOKIE environment variable is required');
  console.error('');
  console.error('Usage: COOKIE="session=xxx" node scripts/batch-pregen.cjs');
  console.error('');
  console.error('Get your session cookie from browser DevTools:');
  console.error('  1. Go to https://hkdse-physics-ai-tutor.pages.dev/admin-pool');
  console.error('  2. Open DevTools > Application > Cookies');
  console.error('  3. Copy the full cookie string (e.g., "session=abc123...")');
  process.exit(1);
}

// Calculate totals
const totalCombinations = SUBTOPICS.length * LANGUAGES.length * QTYPES.length;
console.log('');
console.log('🚀 Batch Pre-generation Script');
console.log('================================');
console.log(`📚 Subtopics: ${SUBTOPICS.length}`);
console.log(`🌐 Languages: ${LANGUAGES.join(', ')}`);
console.log(`📝 Question Types: ${QTYPES.join(', ')}`);
console.log(`📊 Total combinations: ${totalCombinations}`);
console.log(`⏱️  Estimated time: ${Math.ceil(totalCombinations * 18 / 60)} minutes`);
console.log('');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callPregenAPI(subtopic, language, qtype) {
  const url = `${API_BASE}/api/admin/pregen`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': SESSION_COOKIE,
    },
    body: JSON.stringify({
      subtopic,
      language,
      qtype,
      count: 1,
      difficulty: 3,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

async function waitForJobCompletion(jobId, maxWaitSeconds = 180) { // 3 minutes for Pro model
  const startTime = Date.now();

  while (true) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > maxWaitSeconds) {
      return { status: 'timeout', elapsed };
    }

    const url = `${API_BASE}/api/admin/pregen-status?jobId=${jobId}`;
    const response = await fetch(url, {
      headers: { 'Cookie': SESSION_COOKIE },
    });

    if (!response.ok) {
      await sleep(2000);
      continue;
    }

    const data = await response.json();
    const job = data.job;

    if (!job) {
      await sleep(2000);
      continue;
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return {
        status: job.status,
        completedCount: job.completedCount,
        failedCount: job.failedCount,
        elapsed: Math.round(elapsed),
      };
    }

    await sleep(2000);
  }
}

async function main() {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  let current = 0;

  for (const subtopic of SUBTOPICS) {
    for (const language of LANGUAGES) {
      for (const qtype of QTYPES) {
        current++;
        const combo = `${subtopic} | ${language.toUpperCase()} | ${qtype.toUpperCase()}`;

        process.stdout.write(`[${current}/${totalCombinations}] ${combo} ... `);

        try {
          // Start the job
          const startResult = await callPregenAPI(subtopic, language, qtype);
          const jobId = startResult.jobId;

          if (!jobId) {
            throw new Error('No jobId returned');
          }

          // Wait for completion
          const jobResult = await waitForJobCompletion(jobId);

          if (jobResult.status === 'completed' && jobResult.completedCount > 0) {
            console.log(`✅ Done (${jobResult.elapsed}s)`);
            results.success++;
          } else if (jobResult.status === 'timeout') {
            console.log(`⏱️ Timeout`);
            results.failed++;
            results.errors.push({ combo, error: 'Timeout' });
          } else {
            console.log(`❌ Failed`);
            results.failed++;
            results.errors.push({ combo, error: jobResult.status });
          }

        } catch (err) {
          console.log(`❌ Error: ${err.message}`);
          results.failed++;
          results.errors.push({ combo, error: err.message });
        }

        // Delay between calls
        if (current < totalCombinations) {
          await sleep(DELAY_BETWEEN_CALLS);
        }
      }
    }
  }

  // Print summary
  console.log('');
  console.log('================================');
  console.log('📊 Summary');
  console.log('================================');
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('');
    console.log('Failed combinations:');
    results.errors.forEach(e => {
      console.log(`  - ${e.combo}: ${e.error}`);
    });
  }

  console.log('');
  console.log('🎉 Batch pre-generation complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

