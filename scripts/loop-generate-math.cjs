/**
 * Loop generate math questions for 3 hours
 * Automatically cycles through all topics repeatedly
 * Run: OPENAI_API_KEY=xxx node scripts/loop-generate-math.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

// Duration: 3 hours in milliseconds
const DURATION_MS = 3 * 60 * 60 * 1000;
const START_TIME = Date.now();

// All 51 subtopics
const ALL_SUBTOPICS = [
  // Number and Algebra (10)
  { id: 'math_na_1', name: '指數定律', nameEn: 'Laws of Indices' },
  { id: 'math_na_2', name: '多項式', nameEn: 'Polynomials' },
  { id: 'math_na_3', name: '因式分解', nameEn: 'Factorization' },
  { id: 'math_na_4', name: '二次方程', nameEn: 'Quadratic Equations' },
  { id: 'math_na_5', name: '函數及其圖像', nameEn: 'Functions and Graphs' },
  { id: 'math_na_6', name: '指數函數與對數函數', nameEn: 'Exponential and Logarithmic Functions' },
  { id: 'math_na_7', name: '等差數列與等比數列', nameEn: 'Arithmetic and Geometric Sequences' },
  { id: 'math_na_8', name: '不等式', nameEn: 'Inequalities' },
  { id: 'math_na_9', name: '線性規劃', nameEn: 'Linear Programming' },
  { id: 'math_na_10', name: '變分', nameEn: 'Variations' },
  // Geometry (8)
  { id: 'math_geo_1', name: '直線方程', nameEn: 'Equations of Straight Lines' },
  { id: 'math_geo_2', name: '圓的方程', nameEn: 'Equations of Circles' },
  { id: 'math_geo_3', name: '軌跡', nameEn: 'Locus' },
  { id: 'math_geo_4', name: '演繹幾何', nameEn: 'Deductive Geometry' },
  { id: 'math_geo_5', name: '平面圖形的面積與周界', nameEn: 'Area and Perimeter' },
  { id: 'math_geo_6', name: '立體圖形', nameEn: 'Solid Figures' },
  { id: 'math_geo_7', name: '三維圖形的體積與表面積', nameEn: '3D Volume and Surface Area' },
  { id: 'math_geo_8', name: '相似與全等', nameEn: 'Similarity and Congruence' },
  // Trigonometry (6)
  { id: 'math_trig_1', name: '三角比', nameEn: 'Trigonometric Ratios' },
  { id: 'math_trig_2', name: '三角函數的圖像', nameEn: 'Graphs of Trig Functions' },
  { id: 'math_trig_3', name: '三角恆等式', nameEn: 'Trigonometric Identities' },
  { id: 'math_trig_4', name: '解三角形', nameEn: 'Solving Triangles' },
  { id: 'math_trig_5', name: '弧度制與扇形', nameEn: 'Radian Measure' },
  { id: 'math_trig_6', name: '二維與三維問題', nameEn: '2D and 3D Problems' },
  // Statistics (5)
  { id: 'math_stat_1', name: '統計的表達方式', nameEn: 'Statistics Presentation' },
  { id: 'math_stat_2', name: '集中趨勢的量度', nameEn: 'Central Tendency' },
  { id: 'math_stat_3', name: '離差的量度', nameEn: 'Dispersion' },
  { id: 'math_stat_4', name: '概率', nameEn: 'Probability' },
  { id: 'math_stat_5', name: '排列與組合', nameEn: 'Permutations & Combinations' },
  // M1 (9)
  { id: 'math_m1_1', name: '二項式展開', nameEn: 'Binomial Expansion' },
  { id: 'math_m1_2', name: '極限與微分', nameEn: 'Limits and Differentiation' },
  { id: 'math_m1_3', name: '微分的應用', nameEn: 'Applications of Differentiation' },
  { id: 'math_m1_4', name: '積分', nameEn: 'Integration' },
  { id: 'math_m1_5', name: '定積分的應用', nameEn: 'Applications of Integration' },
  { id: 'math_m1_6', name: '離散隨機變量', nameEn: 'Discrete Random Variables' },
  { id: 'math_m1_7', name: '二項分佈', nameEn: 'Binomial Distribution' },
  { id: 'math_m1_8', name: '正態分佈', nameEn: 'Normal Distribution' },
  { id: 'math_m1_9', name: '抽樣分佈與估計', nameEn: 'Sampling & Estimation' },
  // M2 (13)
  { id: 'math_m2_1', name: '數學歸納法', nameEn: 'Mathematical Induction' },
  { id: 'math_m2_2', name: '二項式定理', nameEn: 'Binomial Theorem' },
  { id: 'math_m2_3', name: '三角學進階', nameEn: 'Advanced Trigonometry' },
  { id: 'math_m2_4', name: 'e 和自然對數', nameEn: 'e and Natural Log' },
  { id: 'math_m2_5', name: '極限', nameEn: 'Limits' },
  { id: 'math_m2_6', name: '微分法', nameEn: 'Differentiation' },
  { id: 'math_m2_7', name: '微分的應用', nameEn: 'Applications of Differentiation' },
  { id: 'math_m2_8', name: '不定積分', nameEn: 'Indefinite Integration' },
  { id: 'math_m2_9', name: '定積分', nameEn: 'Definite Integration' },
  { id: 'math_m2_10', name: '定積分的應用', nameEn: 'Applications of Integration' },
  { id: 'math_m2_11', name: '矩陣', nameEn: 'Matrices' },
  { id: 'math_m2_12', name: '線性方程組', nameEn: 'Linear Equations' },
  { id: 'math_m2_13', name: '向量', nameEn: 'Vectors' },
];

// 6 question types (all combinations)
const QUESTION_TYPES = [
  { lang: 'en', qtype: 'mc' },
  { lang: 'en', qtype: 'short' },
  { lang: 'en', qtype: 'long' },
  { lang: 'zh', qtype: 'mc' },
  { lang: 'zh', qtype: 'short' },
  { lang: 'zh', qtype: 'long' },
];

const PROMPTS = {
  mc: {
    en: `HKDSE Math MC for {topic}. LaTeX math with $. JSON only: {"question":"","options":["A.","B.","C.","D."],"correctAnswer":"A","explanation":"","topic":"{id}","score":1}`,
    zh: `HKDSE數學選擇題「{nameZh}」。LaTeX用$。只回JSON: {"question":"","options":["A.","B.","C.","D."],"correctAnswer":"A","explanation":"","topic":"{id}","score":1}`
  },
  short: {
    en: `HKDSE Math short question (4-6 marks) for {topic}. LaTeX. JSON: {"question":"","modelAnswer":"","markingScheme":["1M","2M"],"topic":"{id}","totalMarks":4}`,
    zh: `HKDSE數學簡答題(4-6分)「{nameZh}」。LaTeX。JSON: {"question":"","modelAnswer":"","markingScheme":["1分","2分"],"topic":"{id}","totalMarks":4}`
  },
  long: {
    en: `HKDSE Math long question (8-12 marks, 2-3 parts) for {topic}. LaTeX. JSON: {"question":"","parts":[{"part":"a","question":"","marks":3,"modelAnswer":""},{"part":"b","question":"","marks":4,"modelAnswer":""}],"topic":"{id}","totalMarks":10}`,
    zh: `HKDSE數學長題目(8-12分,2-3部分)「{nameZh}」。LaTeX。JSON: {"question":"","parts":[{"part":"a","question":"","marks":3,"modelAnswer":""},{"part":"b","question":"","marks":4,"modelAnswer":""}],"topic":"{id}","totalMarks":10}`
  }
};

function getTimeRemaining() {
  const elapsed = Date.now() - START_TIME;
  const remaining = DURATION_MS - elapsed;
  const hours = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  return { remaining, str: `${hours}h ${mins}m` };
}

async function generateQuestion(subtopic, lang, qtype) {
  const prompt = PROMPTS[qtype][lang]
    .replace(/{topic}/g, subtopic.nameEn)
    .replace(/{nameZh}/g, subtopic.name)
    .replace(/{id}/g, subtopic.id);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Valid JSON only. No markdown. Escape LaTeX backslashes.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const q = JSON.parse(content);
    q.topic = subtopic.id;
    return q;
  } catch { return null; }
}

async function uploadToDb(subtopic, question, lang, qtype) {
  const json = JSON.stringify(question).replace(/'/g, "''");
  const id = `qb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const sql = `INSERT INTO question_bank (id,subject,topic_key,language,qtype,difficulty,question_json,status,kb_backend,rewrite_mode,llm_model) VALUES ('${id}','Mathematics','${subtopic.id}','${lang}','${qtype}',3,'${json}','ready','none',0,'gpt-4o-mini');`;
  fs.writeFileSync(path.join(__dirname, 'temp.sql'), sql);
  try {
    execSync(`npx wrangler d1 execute hkdse-physics-tutor-db --remote --file="${path.join(__dirname, 'temp.sql')}"`, { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
    return true;
  } catch { return false; }
}

async function main() {
  console.log('🔄 LOOP GENERATE - Running for 3 hours');
  console.log('━'.repeat(50));
  
  let round = 0;
  let totalSuccess = 0;
  let totalFail = 0;
  
  while (getTimeRemaining().remaining > 0) {
    round++;
    const time = getTimeRemaining();
    console.log(`\n🔁 ROUND ${round} | ⏱️ ${time.str} remaining`);
    console.log('━'.repeat(50));
    
    let roundSuccess = 0;
    let roundFail = 0;
    
    // Shuffle subtopics and question types for variety
    const shuffledSubtopics = [...ALL_SUBTOPICS].sort(() => Math.random() - 0.5);
    
    for (const sub of shuffledSubtopics) {
      if (getTimeRemaining().remaining <= 0) break;
      
      // Pick a random question type
      const qt = QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];
      
      process.stdout.write(`${sub.id} [${qt.lang}-${qt.qtype}] `);
      
      const q = await generateQuestion(sub, qt.lang, qt.qtype);
      if (q && await uploadToDb(sub, q, qt.lang, qt.qtype)) {
        console.log('✅');
        roundSuccess++;
        totalSuccess++;
      } else {
        console.log('❌');
        roundFail++;
        totalFail++;
      }
      
      // Small delay
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`\n📊 Round ${round}: ${roundSuccess}✓ ${roundFail}✗ | Total: ${totalSuccess}✓ ${totalFail}✗`);
  }
  
  try { fs.unlinkSync(path.join(__dirname, 'temp.sql')); } catch {}
  
  console.log('\n' + '═'.repeat(50));
  console.log(`🏁 FINISHED after ${round} rounds`);
  console.log(`📊 Total: ${totalSuccess} success, ${totalFail} failed`);
  console.log(`📊 Questions added: ${totalSuccess}`);
}

main();

