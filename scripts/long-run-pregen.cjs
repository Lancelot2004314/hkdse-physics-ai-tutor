/**
 * Long-Running Pre-generation Script (3 Hours)
 * Generates questions organized by topic, cycling continuously for 3 hours
 * 
 * Order: Topic → Subtopics → Question Types → Languages
 * Example: heat_gas → heat_1 → MC(ZH), MC(EN), SHORT(ZH), SHORT(EN), LONG(ZH), LONG(EN)
 *          then heat_2, heat_3, heat_4, then mechanics, etc.
 * 
 * Usage:
 *   COOKIE="session=xxx" node scripts/long-run-pregen.cjs
 */

const API_BASE = 'https://hkdse-physics-ai-tutor.pages.dev';
const RUNTIME_HOURS = 3;
const RUNTIME_MS = RUNTIME_HOURS * 60 * 60 * 1000; // 3 hours in milliseconds
const DELAY_BETWEEN_CALLS = 3000; // 3 seconds between API calls
const MAX_WAIT_SECONDS = 180; // 3 minutes max wait per job

// Topics organized in order (matching shared/topics.js structure)
const TOPICS = [
  {
    id: 'heat_gas',
    name: 'Heat and Gases',
    subtopics: ['heat_1', 'heat_2', 'heat_3', 'heat_4']
  },
  {
    id: 'mechanics',
    name: 'Force and Motion',
    subtopics: ['mech_1', 'mech_2', 'mech_3', 'mech_4', 'mech_5', 'mech_6']
  },
  {
    id: 'waves',
    name: 'Waves',
    subtopics: ['wave_1', 'wave_2', 'wave_3']
  },
  {
    id: 'electricity',
    name: 'Electricity and Magnetism',
    subtopics: ['elec_1', 'elec_2', 'elec_3', 'elec_4']
  },
  {
    id: 'radioactivity',
    name: 'Radioactivity and Nuclear Energy',
    subtopics: ['radio_1', 'radio_2', 'radio_3']
  },
  {
    id: 'astronomy',
    name: 'Astronomy and Space Science',
    subtopics: ['astro_1', 'astro_2', 'astro_3']
  }
];

const QTYPES = ['mc', 'short', 'long'];
const LANGUAGES = ['zh', 'en'];

// Get session cookie from environment
const SESSION_COOKIE = process.env.COOKIE;

if (!SESSION_COOKIE) {
  console.error('❌ Error: COOKIE environment variable is required');
  console.error('');
  console.error('Usage: COOKIE="session=xxx" node scripts/long-run-pregen.cjs');
  console.error('');
  console.error('Get your session cookie from browser DevTools:');
  console.error('  1. Go to https://hkdse-physics-ai-tutor.pages.dev/admin-pool');
  console.error('  2. Open DevTools > Application > Cookies');
  console.error('  3. Copy the full cookie string (e.g., "session=abc123...")');
  process.exit(1);
}

// Calculate totals
const totalSubtopics = TOPICS.reduce((sum, t) => sum + t.subtopics.length, 0);
const combinationsPerRound = totalSubtopics * QTYPES.length * LANGUAGES.length;

const startTime = Date.now();
const endTime = startTime + RUNTIME_MS;

console.log('');
console.log('🚀 Long-Running Pre-generation Script');
console.log('=====================================');
console.log(`⏱️  Runtime: ${RUNTIME_HOURS} hours`);
console.log(`📚 Topics: ${TOPICS.length}`);
console.log(`📖 Subtopics: ${totalSubtopics}`);
console.log(`📝 Question Types: ${QTYPES.join(', ')}`);
console.log(`🌐 Languages: ${LANGUAGES.join(', ')}`);
console.log(`🔄 Combinations per round: ${combinationsPerRound}`);
console.log(`🎯 End time: ${new Date(endTime).toLocaleTimeString()}`);
console.log('');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTimeRemaining(ms) {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function isTimeUp() {
  return Date.now() >= endTime;
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

async function waitForJobCompletion(jobId) {
  const jobStartTime = Date.now();

  while (true) {
    // Check if overall time is up
    if (isTimeUp()) {
      return { status: 'time_up' };
    }

    const elapsed = (Date.now() - jobStartTime) / 1000;
    if (elapsed > MAX_WAIT_SECONDS) {
      return { status: 'timeout', elapsed: Math.round(elapsed) };
    }

    try {
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
          completedCount: job.completedCount || job.completed_count || 0,
          failedCount: job.failedCount || job.failed_count || 0,
          elapsed: Math.round(elapsed),
        };
      }

      await sleep(2000);
    } catch (err) {
      await sleep(2000);
    }
  }
}

async function main() {
  const stats = {
    totalSuccess: 0,
    totalFailed: 0,
    rounds: 0,
  };

  let round = 0;

  // Main loop - continue until time is up
  while (!isTimeUp()) {
    round++;
    stats.rounds = round;

    console.log('');
    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`🔄 ROUND ${round} | Time remaining: ${formatTimeRemaining(endTime - Date.now())}`);
    console.log(`═══════════════════════════════════════════════════════`);

    let roundSuccess = 0;
    let roundFailed = 0;
    let currentCombo = 0;

    // Iterate through topics
    for (const topic of TOPICS) {
      if (isTimeUp()) break;

      console.log('');
      console.log(`📚 Topic: ${topic.name}`);
      console.log(`─────────────────────────────────────`);

      // Iterate through subtopics within this topic
      for (const subtopic of topic.subtopics) {
        if (isTimeUp()) break;

        // Iterate through question types
        for (const qtype of QTYPES) {
          if (isTimeUp()) break;

          // Iterate through languages
          for (const language of LANGUAGES) {
            if (isTimeUp()) break;

            currentCombo++;
            const timeRemaining = formatTimeRemaining(endTime - Date.now());
            const combo = `${subtopic} | ${qtype.toUpperCase()} | ${language.toUpperCase()}`;

            process.stdout.write(`  [${currentCombo}/${combinationsPerRound}] ${combo} ... `);

            try {
              // Start the job
              const startResult = await callPregenAPI(subtopic, language, qtype);
              const jobId = startResult.jobId;

              if (!jobId) {
                throw new Error('No jobId returned');
              }

              // Wait for completion
              const jobResult = await waitForJobCompletion(jobId);

              if (jobResult.status === 'time_up') {
                console.log(`⏰ Time's up!`);
                break;
              } else if (jobResult.status === 'completed' && jobResult.completedCount > 0) {
                console.log(`✅ Done (${jobResult.elapsed}s)`);
                roundSuccess++;
                stats.totalSuccess++;
              } else if (jobResult.status === 'timeout') {
                console.log(`⏱️ Timeout`);
                roundFailed++;
                stats.totalFailed++;
              } else {
                console.log(`❌ Failed`);
                roundFailed++;
                stats.totalFailed++;
              }

            } catch (err) {
              console.log(`❌ Error: ${err.message}`);
              roundFailed++;
              stats.totalFailed++;
            }

            // Delay between calls (if not at the end and time isn't up)
            if (!isTimeUp()) {
              await sleep(DELAY_BETWEEN_CALLS);
            }
          }
        }
      }
    }

    // Round summary
    if (!isTimeUp()) {
      console.log('');
      console.log(`📊 Round ${round} Summary: ✅ ${roundSuccess} | ❌ ${roundFailed}`);
    }
  }

  // Final summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🏁 FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`⏱️  Total runtime: ${RUNTIME_HOURS} hours`);
  console.log(`🔄 Rounds completed: ${stats.rounds}`);
  console.log(`✅ Total successful: ${stats.totalSuccess}`);
  console.log(`❌ Total failed: ${stats.totalFailed}`);
  console.log(`📈 Success rate: ${stats.totalSuccess + stats.totalFailed > 0
    ? Math.round(stats.totalSuccess / (stats.totalSuccess + stats.totalFailed) * 100)
    : 0}%`);
  console.log('');
  console.log('🎉 Long-running pre-generation complete!');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Received interrupt signal. Stopping gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Received termination signal. Stopping gracefully...');
  process.exit(0);
});

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

