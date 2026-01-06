/**
 * Convert MC Questions to Duolingo-style Question Types
 * 
 * Uses OpenAI gpt-5.2 to convert existing MC questions to:
 * - fill-in: Fill in the blank
 * - matching: Match pairs
 * - ordering: Arrange in order
 * 
 * Run:
 *   OPENAI_API_KEY=xxx node scripts/convert-question-types.cjs
 *   
 *   Options:
 *   --skill-node=heat-1a   Convert only for specific skill node
 *   --target-type=fill-in  Target conversion type (fill-in, matching, ordering)
 *   --limit=50             Maximum questions to convert
 *   --dry-run              Preview without saving to database
 * 
 * Model: gpt-5.2 (as specified by user)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-5.2'; // User selected model for conversion
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second

// Parse command line args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const LIMIT = parseInt(args.limit) || 50;
const TARGET_TYPE = args['target-type'] || null; // null = all types
const DRY_RUN = args['dry-run'] === true;

if (!OPENAI_API_KEY) {
  console.error('❌ Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

// Conversion prompts
const CONVERSION_PROMPTS = {
  'fill-in': (mcQuestion) => `Convert this HKDSE Physics multiple choice question into a fill-in-the-blank question.

Original MC Question:
${JSON.stringify(mcQuestion, null, 2)}

Requirements:
- Extract the key concept being tested
- Create a sentence with 1-2 blanks (use ___ for blanks)
- Make it quick to answer (10-30 seconds)
- Keep LaTeX formulas ($...$) intact
- Provide hints for each blank

Respond with JSON only:
{
  "question": "The formula for kinetic energy is KE = ___",
  "blanks": ["½mv²"],
  "hints": ["Hint for the blank"],
  "explanation": "Brief explanation",
  "originalCorrectAnswer": "${mcQuestion.correctAnswer || 'A'}"
}`,

  'matching': (mcQuestion) => `Convert this HKDSE Physics multiple choice question into a matching question.

Original MC Question:
${JSON.stringify(mcQuestion, null, 2)}

Requirements:
- Create 4 pairs of related items to match
- Items should test similar concepts from the question
- Keep it quick to answer (20-40 seconds)
- Keep LaTeX formulas ($...$) intact

Respond with JSON only:
{
  "question": "Match the concepts",
  "leftItems": ["Item 1", "Item 2", "Item 3", "Item 4"],
  "rightItems": ["Match 1", "Match 2", "Match 3", "Match 4"],
  "correctPairs": [[0,0], [1,1], [2,2], [3,3]],
  "explanation": "Brief explanation"
}`,

  'ordering': (mcQuestion) => `Convert this HKDSE Physics multiple choice question into an ordering question.

Original MC Question:
${JSON.stringify(mcQuestion, null, 2)}

Requirements:
- Create 4-5 items that need to be arranged in a logical order
- Order can be: sequence of steps, increasing/decreasing magnitude, chronological, etc.
- Keep it quick to answer (15-30 seconds)
- Keep LaTeX formulas ($...$) intact

Respond with JSON only:
{
  "question": "Arrange the following in order of increasing [property]",
  "items": ["Item 1", "Item 2", "Item 3", "Item 4"],
  "correctOrder": [0, 1, 2, 3],
  "explanation": "Brief explanation of the ordering"
}`,
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchMCQuestions(skillNodeFilter, limit) {
  console.log('📥 Fetching MC questions to convert...\n');
  
  try {
    let whereClause = "qtype = 'mc' AND status = 'ready' AND skill_node_id IS NOT NULL";
    if (skillNodeFilter) {
      whereClause += ` AND skill_node_id = '${skillNodeFilter}'`;
    }
    
    const query = `SELECT id, topic_key, skill_node_id, language, difficulty, calibrated_difficulty, question_json FROM question_bank WHERE ${whereClause} LIMIT ${limit};`;
    
    const result = execSync(
      `npx wrangler d1 execute hkdse-physics-tutor-db --remote --json --command="${query}"`,
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );
    
    const parsed = JSON.parse(result);
    const rows = parsed[0]?.results || [];
    
    console.log(`📊 Found ${rows.length} MC questions available for conversion\n`);
    return rows;
  } catch (err) {
    console.error('Failed to fetch questions:', err.message);
    return [];
  }
}

async function convertQuestion(mcQuestion, targetType) {
  const promptFn = CONVERSION_PROMPTS[targetType];
  if (!promptFn) {
    throw new Error(`Unknown target type: ${targetType}`);
  }
  
  let parsedMC;
  try {
    parsedMC = typeof mcQuestion.question_json === 'string' 
      ? JSON.parse(mcQuestion.question_json) 
      : mcQuestion.question_json;
  } catch {
    return null;
  }
  
  const prompt = promptFn(parsedMC);
  
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
          { role: 'system', content: 'You are a HKDSE Physics expert. Convert questions accurately. Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.5,
      }),
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const converted = JSON.parse(jsonMatch[0]);
      // Add metadata
      converted.sourceQuestionId = mcQuestion.id;
      converted.topic = parsedMC.topic || mcQuestion.topic_key;
      converted.difficulty = mcQuestion.calibrated_difficulty || mcQuestion.difficulty;
      return converted;
    }
    
    return null;
  } catch (err) {
    console.error(`Conversion error: ${err.message}`);
    return null;
  }
}

function generateId() {
  return crypto.randomUUID();
}

function buildInsertSQL(convertedQuestion, original, targetType) {
  const id = generateId();
  const questionJson = JSON.stringify(convertedQuestion).replace(/'/g, "''");
  const now = Date.now();
  
  return `INSERT INTO question_bank (
    id, topic_key, language, qtype, difficulty, question_json, status,
    calibrated_difficulty, skill_node_id, learn_qtype, source_question_id, llm_model, created_at
  ) VALUES (
    '${id}',
    '${original.skill_node_id}',
    '${original.language}',
    'mc',
    ${original.calibrated_difficulty || original.difficulty || 3},
    '${questionJson}',
    'ready',
    ${original.calibrated_difficulty || original.difficulty || 3},
    '${original.skill_node_id}',
    '${targetType}',
    '${original.id}',
    '${MODEL}',
    ${now}
  );`;
}

async function main() {
  console.log('\n🔄 MC to Duolingo Question Type Conversion');
  console.log(`   Model: ${MODEL}`);
  console.log(`   Limit: ${LIMIT} questions`);
  console.log(`   Target Type: ${TARGET_TYPE || 'all (fill-in, matching, ordering)'}`);
  if (DRY_RUN) console.log('   Mode: DRY RUN (no database changes)');
  console.log('='.repeat(60) + '\n');
  
  // Fetch MC questions
  const mcQuestions = await fetchMCQuestions(args['skill-node'], LIMIT);
  
  if (mcQuestions.length === 0) {
    console.log('✅ No MC questions available for conversion.');
    return;
  }
  
  // Determine target types
  const targetTypes = TARGET_TYPE ? [TARGET_TYPE] : ['fill-in', 'matching', 'ordering'];
  
  const totalConversions = mcQuestions.length * targetTypes.length;
  console.log(`📋 Converting ${mcQuestions.length} questions × ${targetTypes.length} types = ${totalConversions} conversions`);
  console.log(`⏱️  Estimated time: ${Math.ceil(totalConversions * 1.5)} seconds\n`);
  
  const sqlStatements = [];
  let converted = 0;
  let errors = 0;
  
  for (const mcQ of mcQuestions) {
    const nodeId = mcQ.skill_node_id;
    console.log(`\n📚 ${mcQ.id.substring(0, 8)}... (${nodeId} D${mcQ.calibrated_difficulty || mcQ.difficulty})`);
    
    for (const targetType of targetTypes) {
      process.stdout.write(`   → ${targetType.padEnd(10)} `);
      
      try {
        const convertedQ = await convertQuestion(mcQ, targetType);
        
        if (convertedQ) {
          const sql = buildInsertSQL(convertedQ, mcQ, targetType);
          sqlStatements.push(sql);
          console.log('✅');
          converted++;
        } else {
          console.log('❌ Failed');
          errors++;
        }
      } catch (err) {
        console.log(`❌ ${err.message}`);
        errors++;
      }
      
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }
  
  // Save to database
  if (sqlStatements.length > 0 && !DRY_RUN) {
    console.log('\n📝 Saving to database...');
    
    const tempFile = path.join(__dirname, 'temp-converted-questions.sql');
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
    
    try { fs.unlinkSync(tempFile); } catch {}
  } else if (DRY_RUN) {
    console.log('\n📄 DRY RUN - Sample SQL statements:');
    console.log(sqlStatements.slice(0, 2).join('\n\n'));
    if (sqlStatements.length > 2) {
      console.log(`... and ${sqlStatements.length - 2} more`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✨ Conversion Complete!`);
  console.log(`   ✅ Converted: ${converted}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📊 Success Rate: ${((converted / (converted + errors)) * 100).toFixed(1)}%`);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});


