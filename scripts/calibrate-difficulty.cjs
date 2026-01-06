/**
 * Difficulty Calibration Script for Duolingo-style Learning System
 * 
 * Uses OpenAI gpt-5.2 to analyze existing questions and:
 * 1. Assign calibrated_difficulty (1-5 scale)
 * 2. Map questions to skill_node_id based on topic
 * 
 * Run: 
 *   First run migration: npx wrangler d1 execute hkdse-physics-tutor-db --remote --file=./migrations/0021_duolingo_learn_system.sql
 *   Then: OPENAI_API_KEY=xxx COOKIE=session=xxx node scripts/calibrate-difficulty.cjs
 * 
 * Model: gpt-5.2 (as specified by user)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SESSION_COOKIE = process.env.COOKIE || '';
const BASE_URL = process.env.BASE_URL || 'https://hkdse-physics-ai-tutor.pages.dev';
const MODEL = 'gpt-5.2'; // User selected model for calibration
const BATCH_SIZE = 10; // Process questions in batches
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

if (!OPENAI_API_KEY) {
  console.error('❌ Please set OPENAI_API_KEY environment variable');
  console.error('   Example: OPENAI_API_KEY=sk-xxx node scripts/calibrate-difficulty.cjs');
  process.exit(1);
}

// Note: COOKIE is optional - we use wrangler for database access

// Topic to Skill Node mapping (from skillTreeConfig.js)
const TOPIC_TO_SKILL_NODE_MAP = {
  // Old format mappings
  'heat_1': 'heat-1a',
  'heat_2': 'heat-1b',
  'heat_3': 'heat-1c',
  'heat_4': 'heat-1d',
  'mech_1': 'motion-2a',
  'mech_2': 'motion-2b',
  'mech_3': 'motion-2c',
  'mech_4': 'motion-2d',
  'mech_5': 'motion-2e',
  'mech_6': 'motion-2f', // Also includes gravitation
  'wave_1': 'wave-3a',
  'wave_2': 'wave-3b',
  'wave_3': 'wave-3c',
  'elec_1': 'em-4a',
  'elec_2': 'em-4b',
  'elec_3': 'em-4c',
  'elec_4': 'em-4c', // AC is part of electromagnetism
  'radio_1': 'nuclear-5a',
  'radio_2': 'nuclear-5b',
  'radio_3': 'nuclear-5c',
  'astro_1': 'elective-astro',
  'astro_2': 'elective-astro',
  'astro_3': 'elective-astro',
  
  // Numeric format mappings
  '1.1': 'heat-1a',
  '1.2': 'heat-1b',
  '1.3': 'heat-1c',
  '1.4': 'heat-1d',
  '2.1': 'motion-2a',
  '2.2': 'motion-2b',
  '2.3': 'motion-2c',
  '2.4': 'motion-2d',
  '2.5': 'motion-2e',
  '2.6': 'motion-2f',
  '2.7': 'motion-2g',
  '3.1': 'wave-3a',
  '3.2': 'wave-3b',
  '3.3': 'wave-3c',
  '4.1': 'em-4a',
  '4.2': 'em-4b',
  '4.3': 'em-4c',
  '5.1': 'nuclear-5a',
  '5.2': 'nuclear-5b',
  '5.3': 'nuclear-5c',
};

function getSkillNodeFromTopic(topicKey) {
  if (!topicKey) return null;
  
  // Direct match
  if (TOPIC_TO_SKILL_NODE_MAP[topicKey]) {
    return TOPIC_TO_SKILL_NODE_MAP[topicKey];
  }
  
  // Handle subtopic keys like "1.1.1" -> "1.1"
  if (topicKey.includes('.')) {
    const parts = topicKey.split('.');
    const mainTopic = parts.slice(0, 2).join('.');
    if (TOPIC_TO_SKILL_NODE_MAP[mainTopic]) {
      return TOPIC_TO_SKILL_NODE_MAP[mainTopic];
    }
  }
  
  // Handle underscore format (e.g., "heat_1_2" -> "heat_1")
  if (topicKey.includes('_')) {
    const parts = topicKey.split('_');
    const mainTopic = parts.slice(0, 2).join('_');
    if (TOPIC_TO_SKILL_NODE_MAP[mainTopic]) {
      return TOPIC_TO_SKILL_NODE_MAP[mainTopic];
    }
  }
  
  return null;
}

// Difficulty calibration prompt
const CALIBRATION_PROMPT = `You are an expert HKDSE Physics teacher. Analyze the following physics question and determine its difficulty level on a scale of 1-5:

1 = Very Easy: Basic recall, simple definitions, single-step calculations
2 = Easy: Straightforward application of one concept
3 = Medium: Multi-step problems, combining 2 concepts
4 = Hard: Complex problems, multiple concepts, requires deeper understanding
5 = Very Hard: Challenging problems, extension topics, university-level thinking

Consider:
- Mathematical complexity
- Number of steps required
- Conceptual depth
- Whether it involves extension curriculum content
- Typical DSE question difficulty

Question: {question}

Respond with ONLY a JSON object:
{
  "difficulty": <1-5>,
  "reasoning": "<brief 1-sentence explanation>"
}`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchQuestions() {
  console.log('📥 Fetching questions from question_bank...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/pool-stats`, {
      headers: { Cookie: SESSION_COOKIE },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log(`📊 Pool stats: ${data.total || 0} total questions`);
    
    // We need to fetch actual questions - the pool-stats only gives counts
    // Let's use a different approach: query via admin API or wrangler
    return data;
  } catch (err) {
    console.error('Failed to fetch pool stats:', err.message);
    return null;
  }
}

async function fetchAllQuestionsViaWrangler() {
  console.log('📥 Fetching questions via wrangler d1 query...');
  
  try {
    // Query to get all questions that need calibration
    const query = `SELECT id, topic_key, language, qtype, difficulty, question_json, calibrated_difficulty, skill_node_id FROM question_bank WHERE status = 'ready' AND calibrated_difficulty IS NULL LIMIT 500;`;
    
    // Save query to temp file
    const tempFile = path.join(__dirname, 'temp-query.sql');
    fs.writeFileSync(tempFile, query);
    
    // Execute via wrangler and capture JSON output
    const result = execSync(
      `npx wrangler d1 execute hkdse-physics-tutor-db --remote --json --command="${query}"`,
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );
    
    // Parse the JSON result
    const parsed = JSON.parse(result);
    const rows = parsed[0]?.results || [];
    
    console.log(`📊 Found ${rows.length} questions needing calibration`);
    return rows;
  } catch (err) {
    console.error('Failed to query database:', err.message);
    console.error('Make sure you have wrangler configured and logged in.');
    return [];
  }
}

async function calibrateDifficulty(questionText) {
  const prompt = CALIBRATION_PROMPT.replace('{question}', questionText.substring(0, 2000)); // Limit size
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a HKDSE Physics difficulty assessor. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3, // Low temperature for consistent assessment
      }),
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        difficulty: Math.min(5, Math.max(1, parseInt(parsed.difficulty) || 3)),
        reasoning: parsed.reasoning || '',
      };
    }
    
    return { difficulty: 3, reasoning: 'Failed to parse response' };
  } catch (err) {
    console.error('Calibration error:', err.message);
    return { difficulty: 3, reasoning: `Error: ${err.message}` };
  }
}

function extractQuestionText(questionJson) {
  try {
    const q = typeof questionJson === 'string' ? JSON.parse(questionJson) : questionJson;
    
    // Handle different question formats
    if (q.question) {
      let text = q.question;
      if (q.options) {
        text += '\nOptions: ' + q.options.join(', ');
      }
      if (q.parts) {
        text += '\nParts: ' + q.parts.map(p => p.question || p.part).join('; ');
      }
      return text;
    }
    
    return JSON.stringify(q).substring(0, 1500);
  } catch {
    return String(questionJson).substring(0, 1500);
  }
}

async function updateQuestionInDB(questionId, calibratedDifficulty, skillNodeId) {
  const sql = `UPDATE question_bank SET calibrated_difficulty = ${calibratedDifficulty}, skill_node_id = ${skillNodeId ? `'${skillNodeId}'` : 'NULL'} WHERE id = '${questionId.replace(/'/g, "''")}';`;
  return sql;
}

async function main() {
  console.log('\n🎯 DSE Physics Question Difficulty Calibration');
  console.log(`   Model: ${MODEL}`);
  console.log(`   Batch Size: ${BATCH_SIZE}`);
  console.log('='.repeat(60) + '\n');
  
  // Fetch questions
  const questions = await fetchAllQuestionsViaWrangler();
  
  if (questions.length === 0) {
    console.log('✅ No questions need calibration (all already calibrated or no questions found)');
    console.log('   To recalibrate, set calibrated_difficulty to NULL first.');
    return;
  }
  
  console.log(`\n📋 Processing ${questions.length} questions in batches of ${BATCH_SIZE}...`);
  console.log(`⏱️  Estimated time: ${Math.ceil(questions.length / BATCH_SIZE * 5)} seconds\n`);
  
  const sqlStatements = [];
  let processed = 0;
  let errors = 0;
  
  // Process in batches
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(questions.length / BATCH_SIZE);
    
    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} questions)`);
    
    // Process batch in parallel
    const promises = batch.map(async (q) => {
      try {
        // Get skill node from topic
        const skillNodeId = getSkillNodeFromTopic(q.topic_key);
        
        // Extract question text for analysis
        const questionText = extractQuestionText(q.question_json);
        
        // Calibrate difficulty using AI
        const result = await calibrateDifficulty(questionText);
        
        process.stdout.write(`   ${q.id.substring(0, 8)}... → D${result.difficulty} (${skillNodeId || 'no-skill'})\n`);
        
        return {
          id: q.id,
          calibratedDifficulty: result.difficulty,
          skillNodeId: skillNodeId,
          reasoning: result.reasoning,
        };
      } catch (err) {
        console.error(`   ❌ Error processing ${q.id}: ${err.message}`);
        errors++;
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    
    // Generate SQL for successful calibrations
    for (const result of results) {
      if (result) {
        const sql = await updateQuestionInDB(result.id, result.calibratedDifficulty, result.skillNodeId);
        sqlStatements.push(sql);
        processed++;
      }
    }
    
    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < questions.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }
  
  // Execute all SQL updates
  if (sqlStatements.length > 0) {
    console.log('\n📝 Writing calibration updates to database...');
    
    const tempFile = path.join(__dirname, 'temp-calibration.sql');
    fs.writeFileSync(tempFile, sqlStatements.join('\n'));
    
    try {
      execSync(
        `npx wrangler d1 execute hkdse-physics-tutor-db --remote --file="${tempFile}"`,
        { cwd: path.join(__dirname, '..'), stdio: 'pipe' }
      );
      console.log('✅ Database updated successfully');
    } catch (err) {
      console.error('❌ Failed to update database:', err.message);
      console.log('📄 SQL file saved to:', tempFile);
    }
    
    // Cleanup
    try { fs.unlinkSync(tempFile); } catch {}
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✨ Calibration Complete!`);
  console.log(`   ✅ Processed: ${processed}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📊 Success Rate: ${((processed / (processed + errors)) * 100).toFixed(1)}%`);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});

