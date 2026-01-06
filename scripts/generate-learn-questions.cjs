/**
 * Generate Questions for Duolingo-style Learning System
 * 
 * Uses OpenAI gpt-5.2 to generate new questions based on gap analysis.
 * Supports:
 * - Traditional types: mc, short, long
 * - Duolingo types: fill-in, matching, ordering
 * 
 * Uses Vertex RAG to retrieve curriculum context for better question quality.
 * 
 * Run:
 *   OPENAI_API_KEY=xxx COOKIE=session=xxx node scripts/generate-learn-questions.cjs
 *   
 *   Options:
 *   --skill-node=heat-1a   Generate only for specific skill node
 *   --difficulty=3         Generate only for specific difficulty
 *   --qtype=fill-in        Generate only for specific question type
 *   --count=5              Number of questions to generate per gap
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
const SESSION_COOKIE = process.env.COOKIE || '';
const BASE_URL = process.env.BASE_URL || 'https://hkdse-physics-ai-tutor.pages.dev';
const MODEL = 'gpt-5.2'; // User selected model for generation
const DELAY_BETWEEN_REQUESTS = 1500; // 1.5 seconds

// Parse command line args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

const DEFAULT_COUNT_PER_GAP = parseInt(args.count) || 3;
const DRY_RUN = args['dry-run'] === true;

if (!OPENAI_API_KEY) {
  console.error('❌ Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

// Skill node metadata
const SKILL_NODE_INFO = {
  'heat-1a': { name: 'Temperature, Heat and Internal Energy', name_zh: '溫度、熱和內能', unit: 'Heat and Gases' },
  'heat-1b': { name: 'Transfer Processes', name_zh: '傳熱過程', unit: 'Heat and Gases' },
  'heat-1c': { name: 'Change of State', name_zh: '物態變化', unit: 'Heat and Gases' },
  'heat-1d': { name: 'Gases', name_zh: '氣體', unit: 'Heat and Gases' },
  'motion-2a': { name: 'Position and Movement', name_zh: '位置與運動', unit: 'Force and Motion' },
  'motion-2b': { name: 'Force and Motion', name_zh: '力與運動', unit: 'Force and Motion' },
  'motion-2c': { name: 'Projectile Motion', name_zh: '拋體運動', unit: 'Force and Motion' },
  'motion-2d': { name: 'Work, Energy and Power', name_zh: '功、能量和功率', unit: 'Force and Motion' },
  'motion-2e': { name: 'Momentum', name_zh: '動量', unit: 'Force and Motion' },
  'motion-2f': { name: 'Uniform Circular Motion', name_zh: '勻速圓周運動', unit: 'Force and Motion' },
  'motion-2g': { name: 'Gravitation', name_zh: '萬有引力', unit: 'Force and Motion' },
  'wave-3a': { name: 'Nature and Properties of Waves', name_zh: '波的性質', unit: 'Wave Motion' },
  'wave-3b': { name: 'Light', name_zh: '光學', unit: 'Wave Motion' },
  'wave-3c': { name: 'Sound', name_zh: '聲學', unit: 'Wave Motion' },
  'em-4a': { name: 'Electrostatics', name_zh: '靜電學', unit: 'Electricity and Magnetism' },
  'em-4b': { name: 'Circuits and Domestic Electricity', name_zh: '電路與家居電學', unit: 'Electricity and Magnetism' },
  'em-4c': { name: 'Electromagnetism', name_zh: '電磁學', unit: 'Electricity and Magnetism' },
  'nuclear-5a': { name: 'Radiation and Radioactivity', name_zh: '輻射與放射性', unit: 'Radioactivity' },
  'nuclear-5b': { name: 'Atomic Model', name_zh: '原子模型', unit: 'Radioactivity' },
  'nuclear-5c': { name: 'Nuclear Energy', name_zh: '核能', unit: 'Radioactivity' },
  'elective-astro': { name: 'Astronomy and Space Science', name_zh: '天文學與太空科學', unit: 'Elective' },
  'elective-atomic': { name: 'Atomic World', name_zh: '原子世界', unit: 'Elective' },
};

// Difficulty descriptions
const DIFFICULTY_DESC = {
  1: 'Very Easy - basic recall, simple definitions, single-step',
  2: 'Easy - straightforward application of one concept',
  3: 'Medium - multi-step problems, combining 2 concepts',
  4: 'Hard - complex problems, multiple concepts, deeper understanding',
  5: 'Very Hard - challenging, extension topics, advanced reasoning',
};

// Question type prompts
const PROMPTS = {
  mc: (topic, diff, lang) => lang === 'zh' ?
    `你是HKDSE物理教師。為「${topic.name_zh}」創建一道${DIFFICULTY_DESC[diff]}的選擇題。

要求：
- 符合DSE考試風格和難度
- 物理公式使用LaTeX ($...$)
- 選項清晰且有區分度
- 包含詳細解釋

只回應JSON格式：
{
  "question": "題目內容",
  "options": ["A. 選項一", "B. 選項二", "C. 選項三", "D. 選項四"],
  "correctAnswer": "A",
  "explanation": "詳細解釋為什麼答案正確",
  "topic": "${topic.name_zh}",
  "difficulty": ${diff}
}` :
    `You are a HKDSE Physics teacher. Create a multiple choice question for "${topic.name}" at difficulty level: ${DIFFICULTY_DESC[diff]}.

Requirements:
- Follow DSE exam style and difficulty
- Use LaTeX for physics formulas ($...$)
- Clear, well-differentiated options
- Include detailed explanation

Respond with JSON only:
{
  "question": "Question text",
  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
  "correctAnswer": "A",
  "explanation": "Detailed explanation of why the answer is correct",
  "topic": "${topic.name}",
  "difficulty": ${diff}
}`,

  short: (topic, diff, lang) => lang === 'zh' ?
    `你是HKDSE物理教師。為「${topic.name_zh}」創建一道${DIFFICULTY_DESC[diff]}的簡答題(4-6分)。

要求：
- 符合DSE考試風格
- 物理公式使用LaTeX ($...$)
- 包含評分方案

只回應JSON格式：
{
  "question": "題目內容",
  "modelAnswer": "標準答案",
  "markingScheme": ["1分: 第一要點", "2分: 第二要點", "2分: 計算正確"],
  "totalMarks": 5,
  "topic": "${topic.name_zh}",
  "difficulty": ${diff}
}` :
    `You are a HKDSE Physics teacher. Create a short answer question (4-6 marks) for "${topic.name}" at difficulty: ${DIFFICULTY_DESC[diff]}.

Requirements:
- Follow DSE exam style
- Use LaTeX for formulas ($...$)
- Include marking scheme

Respond with JSON only:
{
  "question": "Question text",
  "modelAnswer": "Model answer with steps",
  "markingScheme": ["1M: First point", "2M: Second point", "2M: Correct calculation"],
  "totalMarks": 5,
  "topic": "${topic.name}",
  "difficulty": ${diff}
}`,

  long: (topic, diff, lang) => lang === 'zh' ?
    `你是HKDSE物理教師。為「${topic.name_zh}」創建一道${DIFFICULTY_DESC[diff]}的長題目(8-12分，2-3部分)。

要求：
- 符合DSE考試風格
- 分為多個部分，難度遞進
- 物理公式使用LaTeX ($...$)

只回應JSON格式：
{
  "question": "題目背景和情境",
  "parts": [
    {"part": "a", "question": "第一部分問題", "marks": 3, "modelAnswer": "答案"},
    {"part": "b", "question": "第二部分問題", "marks": 4, "modelAnswer": "答案"},
    {"part": "c", "question": "第三部分問題", "marks": 4, "modelAnswer": "答案"}
  ],
  "totalMarks": 11,
  "topic": "${topic.name_zh}",
  "difficulty": ${diff}
}` :
    `You are a HKDSE Physics teacher. Create a long question (8-12 marks, 2-3 parts) for "${topic.name}" at difficulty: ${DIFFICULTY_DESC[diff]}.

Requirements:
- Follow DSE exam style
- Multiple parts with progressive difficulty
- Use LaTeX for formulas ($...$)

Respond with JSON only:
{
  "question": "Context and scenario",
  "parts": [
    {"part": "a", "question": "Part a question", "marks": 3, "modelAnswer": "Answer"},
    {"part": "b", "question": "Part b question", "marks": 4, "modelAnswer": "Answer"},
    {"part": "c", "question": "Part c question", "marks": 4, "modelAnswer": "Answer"}
  ],
  "totalMarks": 11,
  "topic": "${topic.name}",
  "difficulty": ${diff}
}`,

  'fill-in': (topic, diff, lang) => lang === 'zh' ?
    `你是Duolingo風格的物理學習系統設計師。為「${topic.name_zh}」創建一道${DIFFICULTY_DESC[diff]}的填空題。

要求：
- 適合快速練習（10-30秒完成）
- 測試關鍵概念或公式
- 使用 ___ 表示空白處
- 物理公式使用LaTeX ($...$)

只回應JSON格式：
{
  "question": "牛頓第二定律可表示為 F = ___",
  "blanks": ["ma"],
  "hints": ["力等於質量乘以..."],
  "explanation": "解釋為什麼這是正確答案",
  "topic": "${topic.name_zh}",
  "difficulty": ${diff}
}` :
    `You are a Duolingo-style physics learning system designer. Create a fill-in-the-blank question for "${topic.name}" at difficulty: ${DIFFICULTY_DESC[diff]}.

Requirements:
- Quick practice (10-30 seconds to complete)
- Test key concepts or formulas
- Use ___ for blank spaces
- Use LaTeX for formulas ($...$)

Respond with JSON only:
{
  "question": "Newton's second law can be expressed as F = ___",
  "blanks": ["ma"],
  "hints": ["Force equals mass times..."],
  "explanation": "Why this is the correct answer",
  "topic": "${topic.name}",
  "difficulty": ${diff}
}`,

  'matching': (topic, diff, lang) => lang === 'zh' ?
    `你是Duolingo風格的物理學習系統設計師。為「${topic.name_zh}」創建一道${DIFFICULTY_DESC[diff]}的配對題。

要求：
- 4-6對項目進行配對
- 適合快速練習
- 測試概念關聯
- 物理公式使用LaTeX ($...$)

只回應JSON格式：
{
  "question": "將物理量與其單位配對",
  "leftItems": ["力", "能量", "功率", "動量"],
  "rightItems": ["牛頓 (N)", "焦耳 (J)", "瓦特 (W)", "千克·米/秒"],
  "correctPairs": [[0,0], [1,1], [2,2], [3,3]],
  "explanation": "解釋配對關係",
  "topic": "${topic.name_zh}",
  "difficulty": ${diff}
}` :
    `You are a Duolingo-style physics learning system designer. Create a matching question for "${topic.name}" at difficulty: ${DIFFICULTY_DESC[diff]}.

Requirements:
- 4-6 pairs to match
- Quick practice format
- Test concept relationships
- Use LaTeX for formulas ($...$)

Respond with JSON only:
{
  "question": "Match the physical quantities with their units",
  "leftItems": ["Force", "Energy", "Power", "Momentum"],
  "rightItems": ["Newton (N)", "Joule (J)", "Watt (W)", "kg·m/s"],
  "correctPairs": [[0,0], [1,1], [2,2], [3,3]],
  "explanation": "Explanation of the matching relationships",
  "topic": "${topic.name}",
  "difficulty": ${diff}
}`,

  'ordering': (topic, diff, lang) => lang === 'zh' ?
    `你是Duolingo風格的物理學習系統設計師。為「${topic.name_zh}」創建一道${DIFFICULTY_DESC[diff]}的排序題。

要求：
- 4-6個項目需要排序
- 可以是步驟順序、大小順序、時間順序等
- 適合快速練習
- 物理公式使用LaTeX ($...$)

只回應JSON格式：
{
  "question": "將以下波的頻率從低到高排列",
  "items": ["無線電波", "紅外線", "可見光", "紫外線"],
  "correctOrder": [0, 1, 2, 3],
  "explanation": "電磁波譜中，頻率從無線電波到伽馬射線遞增",
  "topic": "${topic.name_zh}",
  "difficulty": ${diff}
}` :
    `You are a Duolingo-style physics learning system designer. Create an ordering question for "${topic.name}" at difficulty: ${DIFFICULTY_DESC[diff]}.

Requirements:
- 4-6 items to order
- Can be step sequence, magnitude order, time order, etc.
- Quick practice format
- Use LaTeX for formulas ($...$)

Respond with JSON only:
{
  "question": "Arrange the following waves by frequency from lowest to highest",
  "items": ["Radio waves", "Infrared", "Visible light", "Ultraviolet"],
  "correctOrder": [0, 1, 2, 3],
  "explanation": "In the EM spectrum, frequency increases from radio to gamma rays",
  "topic": "${topic.name}",
  "difficulty": ${diff}
}`,
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateQuestion(skillNodeId, difficulty, qtype, language = 'en') {
  const topicInfo = SKILL_NODE_INFO[skillNodeId];
  if (!topicInfo) {
    throw new Error(`Unknown skill node: ${skillNodeId}`);
  }
  
  const promptFn = PROMPTS[qtype];
  if (!promptFn) {
    throw new Error(`Unknown question type: ${qtype}`);
  }
  
  const prompt = promptFn(topicInfo, difficulty, language);
  
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
          { role: 'system', content: 'You are a HKDSE Physics expert. Generate valid JSON only. No markdown code blocks.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
        temperature: 0.8, // Higher temperature for variety
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
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Failed to parse JSON response');
  } catch (err) {
    console.error(`Generation error: ${err.message}`);
    return null;
  }
}

function generateId() {
  return crypto.randomUUID();
}

function buildInsertSQL(question, skillNodeId, difficulty, qtype, language) {
  const id = generateId();
  const questionJson = JSON.stringify(question).replace(/'/g, "''");
  const now = Date.now();
  
  const isLearnType = ['fill-in', 'matching', 'ordering'].includes(qtype);
  
  return `INSERT INTO question_bank (
    id, topic_key, language, qtype, difficulty, question_json, status,
    calibrated_difficulty, skill_node_id, learn_qtype, llm_model, created_at
  ) VALUES (
    '${id}',
    '${skillNodeId}',
    '${language}',
    '${isLearnType ? 'mc' : qtype}',
    ${difficulty},
    '${questionJson}',
    'ready',
    ${difficulty},
    '${skillNodeId}',
    ${isLearnType ? `'${qtype}'` : 'NULL'},
    '${MODEL}',
    ${now}
  );`;
}

async function loadGapAnalysis() {
  const gapFile = path.join(__dirname, 'gap-analysis-results.json');
  
  if (!fs.existsSync(gapFile)) {
    console.log('⚠️  Gap analysis results not found. Running analysis first...\n');
    execSync('node scripts/analyze-gaps.cjs', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  }
  
  const data = JSON.parse(fs.readFileSync(gapFile, 'utf8'));
  return data.actionable || [];
}

async function main() {
  console.log('\n🎯 DSE Physics Question Generation for Learning System');
  console.log(`   Model: ${MODEL}`);
  console.log(`   Questions per gap: ${DEFAULT_COUNT_PER_GAP}`);
  if (DRY_RUN) console.log('   Mode: DRY RUN (no database changes)');
  console.log('='.repeat(60) + '\n');
  
  // Load gaps from analysis
  let gaps = await loadGapAnalysis();
  
  // Apply filters if specified
  if (args['skill-node']) {
    gaps = gaps.filter(g => g.skillNodeId === args['skill-node']);
  }
  if (args['difficulty']) {
    gaps = gaps.filter(g => g.difficulty === parseInt(args['difficulty']));
  }
  if (args['qtype']) {
    gaps = gaps.filter(g => g.qtype === args['qtype']);
  }
  
  if (gaps.length === 0) {
    console.log('✅ No gaps to fill based on current filters.');
    return;
  }
  
  // Limit count per gap
  gaps = gaps.map(g => ({ ...g, count: Math.min(g.count, DEFAULT_COUNT_PER_GAP) }));
  
  const totalToGenerate = gaps.reduce((sum, g) => sum + g.count, 0);
  console.log(`📋 Generating ${totalToGenerate} questions for ${gaps.length} gaps...`);
  console.log(`⏱️  Estimated time: ${Math.ceil(totalToGenerate * 2)} seconds\n`);
  
  const sqlStatements = [];
  let generated = 0;
  let errors = 0;
  
  for (const gap of gaps) {
    const nodeInfo = SKILL_NODE_INFO[gap.skillNodeId];
    console.log(`\n📚 ${gap.skillNodeId} | D${gap.difficulty} | ${gap.qtype} (×${gap.count})`);
    
    for (let i = 0; i < gap.count; i++) {
      // Alternate between English and Chinese
      const language = i % 2 === 0 ? 'en' : 'zh';
      
      process.stdout.write(`   [${i + 1}/${gap.count}] Generating (${language})... `);
      
      try {
        const question = await generateQuestion(gap.skillNodeId, gap.difficulty, gap.qtype, language);
        
        if (question) {
          const sql = buildInsertSQL(question, gap.skillNodeId, gap.difficulty, gap.qtype, language);
          sqlStatements.push(sql);
          console.log('✅');
          generated++;
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
    
    const tempFile = path.join(__dirname, 'temp-learn-questions.sql');
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
    console.log('\n📄 DRY RUN - SQL statements that would be executed:');
    console.log(sqlStatements.slice(0, 3).join('\n\n'));
    if (sqlStatements.length > 3) {
      console.log(`... and ${sqlStatements.length - 3} more`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✨ Generation Complete!`);
  console.log(`   ✅ Generated: ${generated}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📊 Success Rate: ${((generated / (generated + errors)) * 100).toFixed(1)}%`);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});


