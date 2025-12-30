/**
 * Fill Pool Script
 * Generates questions to fill subtopics that have less than 5 questions
 */

const BASE_URL = 'https://hkdse-physics-ai-tutor.pages.dev';
const TARGET_COUNT = 5; // Target 5 questions per subtopic/language/qtype
const DELAY_BETWEEN_CALLS = 3000; // 3 seconds between API calls

// Get session cookie from environment
const SESSION_COOKIE = process.env.COOKIE || '';

if (!SESSION_COOKIE) {
  console.error('❌ Please set COOKIE environment variable');
  console.error('   Example: COOKIE="session=your_session_id" node scripts/fill-pool.cjs');
  process.exit(1);
}

const SUBTOPICS = [
  'heat_1', 'heat_2', 'heat_3', 'heat_4',
  'mech_1', 'mech_2', 'mech_3', 'mech_4', 'mech_5', 'mech_6',
  'wave_1', 'wave_2', 'wave_3',
  'elec_1', 'elec_2', 'elec_3', 'elec_4',
  'radio_1', 'radio_2', 'radio_3',
  'astro_1', 'astro_2', 'astro_3',
];

const LANGUAGES = ['zh', 'en'];
const QTYPES = ['mc', 'short', 'long'];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPoolStats() {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/pool-stats`, {
      headers: { Cookie: SESSION_COOKIE },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('Failed to get pool stats:', err.message);
    return null;
  }
}

async function callPregenAPI(subtopic, language, qtype, count) {
  const response = await fetch(`${BASE_URL}/api/admin/pregen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: SESSION_COOKIE,
    },
    body: JSON.stringify({
      subtopic,
      language,
      qtype,
      count,
      difficulty: 3,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function waitForJobCompletion(jobId, maxWaitSeconds = 180) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    await sleep(5000); // Check every 5 seconds

    try {
      const response = await fetch(`${BASE_URL}/api/admin/pregen-status?jobId=${jobId}`, {
        headers: { Cookie: SESSION_COOKIE },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const job = data.job;

      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }
    } catch (err) {
      // Continue waiting
    }
  }

  return { status: 'timeout' };
}

async function main() {
  console.log('\n🔍 Fetching current pool stats...\n');

  const stats = await getPoolStats();
  if (!stats) {
    console.error('❌ Failed to get pool stats');
    process.exit(1);
  }

  // Build a map of current counts
  // stats.inventory is an ARRAY: [{ topicKey: 'heat_1', en: { mc: { ready: 5 }, ... }, zh: {...} }, ...]
  const countMap = {};
  const inventoryArray = stats.inventory || [];

  for (const item of inventoryArray) {
    const subtopic = item.topicKey;
    for (const language of ['en', 'zh']) {
      if (!item[language]) continue;
      for (const qtype of ['mc', 'short', 'long']) {
        if (!item[language][qtype]) continue;
        const key = `${subtopic}_${language}_${qtype}`;
        countMap[key] = item[language][qtype].ready || 0;
      }
    }
  }

  // Find combinations that need more questions
  const toFill = [];
  for (const subtopic of SUBTOPICS) {
    for (const language of LANGUAGES) {
      for (const qtype of QTYPES) {
        const key = `${subtopic}_${language}_${qtype}`;
        const current = countMap[key] || 0;
        if (current < TARGET_COUNT) {
          const needed = TARGET_COUNT - current;
          toFill.push({ subtopic, language, qtype, current, needed });
        }
      }
    }
  }

  if (toFill.length === 0) {
    console.log('✅ All subtopics already have at least 5 questions!');
    return;
  }

  console.log(`📋 Found ${toFill.length} combinations needing more questions:\n`);

  let totalNeeded = 0;
  for (const item of toFill) {
    console.log(`   ${item.subtopic} | ${item.language.toUpperCase()} | ${item.qtype.toUpperCase()} - has ${item.current}, need ${item.needed} more`);
    totalNeeded += item.needed;
  }

  console.log(`\n📊 Total questions to generate: ${totalNeeded}`);
  console.log(`⏱️  Estimated time: ${Math.ceil(totalNeeded * 25 / 60)} minutes\n`);
  console.log('='.repeat(60));
  console.log('Starting generation...\n');

  let successCount = 0;
  let failCount = 0;
  let current = 0;

  for (const item of toFill) {
    current++;
    const combo = `${item.subtopic} | ${item.language.toUpperCase()} | ${item.qtype.toUpperCase()}`;
    process.stdout.write(`[${current}/${toFill.length}] ${combo} (need ${item.needed}) ... `);

    try {
      const startResult = await callPregenAPI(item.subtopic, item.language, item.qtype, item.needed);
      const jobId = startResult.jobId;

      const jobResult = await waitForJobCompletion(jobId);

      if (jobResult.status === 'completed') {
        const stored = jobResult.completed_count || 0;
        console.log(`✅ ${stored}/${item.needed} stored`);
        successCount += stored;
      } else if (jobResult.status === 'failed') {
        console.log(`❌ Failed`);
        failCount += item.needed;
      } else {
        console.log(`⏰ Timeout`);
        failCount += item.needed;
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      failCount += item.needed;
    }

    if (current < toFill.length) {
      await sleep(DELAY_BETWEEN_CALLS);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✨ Done!`);
  console.log(`   ✅ Successfully generated: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

