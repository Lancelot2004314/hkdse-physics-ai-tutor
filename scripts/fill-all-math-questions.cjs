/**
 * Fill all missing math questions for every subtopic
 * Generates: EN MC, EN Short, EN Long, ZH Short, ZH Long
 * Run: OPENAI_API_KEY=xxx node scripts/fill-all-math-questions.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

// All subtopics with their names
const ALL_SUBTOPICS = [
  // Number and Algebra
  { id: 'math_na_1', name: '指數定律', nameEn: 'Laws of Indices', category: '數與代數' },
  { id: 'math_na_2', name: '多項式', nameEn: 'Polynomials', category: '數與代數' },
  { id: 'math_na_3', name: '因式分解', nameEn: 'Factorization', category: '數與代數' },
  { id: 'math_na_4', name: '二次方程', nameEn: 'Quadratic Equations', category: '數與代數' },
  { id: 'math_na_5', name: '函數及其圖像', nameEn: 'Functions and Graphs', category: '數與代數' },
  { id: 'math_na_6', name: '指數函數與對數函數', nameEn: 'Exponential and Logarithmic Functions', category: '數與代數' },
  { id: 'math_na_7', name: '等差數列與等比數列', nameEn: 'Arithmetic and Geometric Sequences', category: '數與代數' },
  { id: 'math_na_8', name: '不等式', nameEn: 'Inequalities', category: '數與代數' },
  { id: 'math_na_9', name: '線性規劃', nameEn: 'Linear Programming', category: '數與代數' },
  { id: 'math_na_10', name: '變分', nameEn: 'Variations', category: '數與代數' },
  // Geometry
  { id: 'math_geo_1', name: '直線方程', nameEn: 'Equations of Straight Lines', category: '度量、圖形與空間' },
  { id: 'math_geo_2', name: '圓的方程', nameEn: 'Equations of Circles', category: '度量、圖形與空間' },
  { id: 'math_geo_3', name: '軌跡', nameEn: 'Locus', category: '度量、圖形與空間' },
  { id: 'math_geo_4', name: '演繹幾何', nameEn: 'Deductive Geometry', category: '度量、圖形與空間' },
  { id: 'math_geo_5', name: '平面圖形的面積與周界', nameEn: 'Area and Perimeter of Plane Figures', category: '度量、圖形與空間' },
  { id: 'math_geo_6', name: '立體圖形', nameEn: 'Solid Figures', category: '度量、圖形與空間' },
  { id: 'math_geo_7', name: '三維圖形的體積與表面積', nameEn: 'Volume and Surface Area of 3D Figures', category: '度量、圖形與空間' },
  { id: 'math_geo_8', name: '相似與全等', nameEn: 'Similarity and Congruence', category: '度量、圖形與空間' },
  // Trigonometry
  { id: 'math_trig_1', name: '三角比', nameEn: 'Trigonometric Ratios', category: '三角學' },
  { id: 'math_trig_2', name: '三角函數的圖像', nameEn: 'Graphs of Trigonometric Functions', category: '三角學' },
  { id: 'math_trig_3', name: '三角恆等式', nameEn: 'Trigonometric Identities', category: '三角學' },
  { id: 'math_trig_4', name: '解三角形', nameEn: 'Solving Triangles', category: '三角學' },
  { id: 'math_trig_5', name: '弧度制與扇形', nameEn: 'Radian Measure and Sectors', category: '三角學' },
  { id: 'math_trig_6', name: '二維與三維問題', nameEn: '2D and 3D Problems', category: '三角學' },
  // Statistics
  { id: 'math_stat_1', name: '統計的表達方式', nameEn: 'Presentation of Statistics', category: '數據處理' },
  { id: 'math_stat_2', name: '集中趨勢的量度', nameEn: 'Measures of Central Tendency', category: '數據處理' },
  { id: 'math_stat_3', name: '離差的量度', nameEn: 'Measures of Dispersion', category: '數據處理' },
  { id: 'math_stat_4', name: '概率', nameEn: 'Probability', category: '數據處理' },
  { id: 'math_stat_5', name: '排列與組合', nameEn: 'Permutations and Combinations', category: '數據處理' },
  // M1
  { id: 'math_m1_1', name: '二項式展開', nameEn: 'Binomial Expansion', category: 'M1 微積分與統計' },
  { id: 'math_m1_2', name: '極限與微分', nameEn: 'Limits and Differentiation', category: 'M1 微積分與統計' },
  { id: 'math_m1_3', name: '微分的應用', nameEn: 'Applications of Differentiation', category: 'M1 微積分與統計' },
  { id: 'math_m1_4', name: '積分', nameEn: 'Integration', category: 'M1 微積分與統計' },
  { id: 'math_m1_5', name: '定積分的應用', nameEn: 'Applications of Definite Integration', category: 'M1 微積分與統計' },
  { id: 'math_m1_6', name: '離散隨機變量', nameEn: 'Discrete Random Variables', category: 'M1 微積分與統計' },
  { id: 'math_m1_7', name: '二項分佈', nameEn: 'Binomial Distribution', category: 'M1 微積分與統計' },
  { id: 'math_m1_8', name: '正態分佈', nameEn: 'Normal Distribution', category: 'M1 微積分與統計' },
  { id: 'math_m1_9', name: '抽樣分佈與估計', nameEn: 'Sampling Distribution and Estimation', category: 'M1 微積分與統計' },
  // M2
  { id: 'math_m2_1', name: '數學歸納法', nameEn: 'Mathematical Induction', category: 'M2 代數與微積分' },
  { id: 'math_m2_2', name: '二項式定理', nameEn: 'Binomial Theorem', category: 'M2 代數與微積分' },
  { id: 'math_m2_3', name: '三角學進階', nameEn: 'More about Trigonometry', category: 'M2 代數與微積分' },
  { id: 'math_m2_4', name: 'e 和自然對數', nameEn: 'e and Natural Logarithm', category: 'M2 代數與微積分' },
  { id: 'math_m2_5', name: '極限', nameEn: 'Limits', category: 'M2 代數與微積分' },
  { id: 'math_m2_6', name: '微分法', nameEn: 'Differentiation', category: 'M2 代數與微積分' },
  { id: 'math_m2_7', name: '微分的應用', nameEn: 'Applications of Differentiation', category: 'M2 代數與微積分' },
  { id: 'math_m2_8', name: '不定積分', nameEn: 'Indefinite Integration', category: 'M2 代數與微積分' },
  { id: 'math_m2_9', name: '定積分', nameEn: 'Definite Integration', category: 'M2 代數與微積分' },
  { id: 'math_m2_10', name: '定積分的應用', nameEn: 'Applications of Definite Integration', category: 'M2 代數與微積分' },
  { id: 'math_m2_11', name: '矩陣', nameEn: 'Matrices', category: 'M2 代數與微積分' },
  { id: 'math_m2_12', name: '線性方程組', nameEn: 'Systems of Linear Equations', category: 'M2 代數與微積分' },
  { id: 'math_m2_13', name: '向量', nameEn: 'Vectors', category: 'M2 代數與微積分' },
];

// Question types to generate (missing ones)
const QUESTION_TYPES = [
  { lang: 'en', qtype: 'mc', label: 'EN MC' },
  { lang: 'en', qtype: 'short', label: 'EN Short' },
  { lang: 'en', qtype: 'long', label: 'EN Long' },
  { lang: 'zh', qtype: 'short', label: 'ZH Short' },
  { lang: 'zh', qtype: 'long', label: 'ZH Long' },
];

const PROMPTS = {
  mc: {
    en: `You are a professional HKDSE Mathematics examiner. Generate 1 high-quality multiple choice question.

Topic: {topic} ({topicZh})
Category: {category}

Requirements:
1. Must match HKDSE Mathematics exam style and difficulty
2. Use English
3. Use LaTeX format for math formulas (surrounded by $)
4. Provide 4 options (A, B, C, D)
5. Ensure answer is correct with detailed explanation

Reply in JSON format only (no markdown):
{"question":"Question text","options":["A. Option1","B. Option2","C. Option3","D. Option4"],"correctAnswer":"A","explanation":"Detailed solution","topic":"{topicId}","score":1}`,
    
    zh: `你是一位專業的HKDSE數學科出題員。請生成1道高質量的選擇題。

主題：{topicZh} ({topic})
類別：{category}

要求：
1. 符合HKDSE數學科考試風格和難度
2. 使用繁體中文
3. 數學公式使用 LaTeX 格式（用 $ 包圍）
4. 提供4個選項 (A, B, C, D)
5. 確保答案正確且有詳細解釋

請以純JSON格式回覆（不要markdown）：
{"question":"題目","options":["A. 選項1","B. 選項2","C. 選項3","D. 選項4"],"correctAnswer":"A","explanation":"解釋","topic":"{topicId}","score":1}`
  },
  
  short: {
    en: `You are a professional HKDSE Mathematics examiner. Generate 1 short answer question (4-6 marks).

Topic: {topic} ({topicZh})
Category: {category}

Requirements:
1. Must match HKDSE Mathematics exam style
2. Use English
3. Use LaTeX format for math formulas (surrounded by $)
4. Include model answer and marking scheme

Reply in JSON format only (no markdown):
{"question":"Question text","modelAnswer":"Step by step solution","markingScheme":["1 mark for step 1","2 marks for step 2","1 mark for final answer"],"topic":"{topicId}","totalMarks":4}`,
    
    zh: `你是一位專業的HKDSE數學科出題員。請生成1道簡答題（4-6分）。

主題：{topicZh} ({topic})
類別：{category}

要求：
1. 符合HKDSE數學科考試風格
2. 使用繁體中文
3. 數學公式使用 LaTeX 格式（用 $ 包圍）
4. 包含標準答案和評分準則

請以純JSON格式回覆（不要markdown）：
{"question":"題目","modelAnswer":"逐步解答","markingScheme":["步驟1得1分","步驟2得2分","最終答案得1分"],"topic":"{topicId}","totalMarks":4}`
  },
  
  long: {
    en: `You are a professional HKDSE Mathematics examiner. Generate 1 long question with multiple parts (8-12 marks total).

Topic: {topic} ({topicZh})
Category: {category}

Requirements:
1. Must match HKDSE Mathematics exam style
2. Use English
3. Use LaTeX format for math formulas (surrounded by $)
4. Include 2-3 parts (a), (b), (c)
5. Each part has model answer and marks

Reply in JSON format only (no markdown):
{"question":"Main question stem","parts":[{"part":"a","question":"Part (a) question","marks":3,"modelAnswer":"Solution for (a)"},{"part":"b","question":"Part (b) question","marks":4,"modelAnswer":"Solution for (b)"}],"topic":"{topicId}","totalMarks":10}`,
    
    zh: `你是一位專業的HKDSE數學科出題員。請生成1道長題目（共8-12分，含多個部分）。

主題：{topicZh} ({topic})
類別：{category}

要求：
1. 符合HKDSE數學科考試風格
2. 使用繁體中文
3. 數學公式使用 LaTeX 格式（用 $ 包圍）
4. 包含2-3個部分 (a), (b), (c)
5. 每個部分有答案和分數

請以純JSON格式回覆（不要markdown）：
{"question":"題目主幹","parts":[{"part":"a","question":"(a)部分問題","marks":3,"modelAnswer":"(a)的解答"},{"part":"b","question":"(b)部分問題","marks":4,"modelAnswer":"(b)的解答"}],"topic":"{topicId}","totalMarks":10}`
  }
};

async function generateQuestion(subtopic, lang, qtype) {
  const promptTemplate = PROMPTS[qtype][lang];
  const prompt = promptTemplate
    .replace(/{topic}/g, subtopic.nameEn)
    .replace(/{topicZh}/g, subtopic.name)
    .replace(/{category}/g, subtopic.category)
    .replace(/{topicId}/g, subtopic.id);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: lang === 'en' ? 'You are a HKDSE Math examiner. Reply with valid JSON only, no markdown.' : '你是HKDSE數學科專業出題員。只回覆有效JSON，不要markdown。' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API ${response.status}: ${err.slice(0, 100)}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    const question = JSON.parse(content);
    question.topic = subtopic.id;
    return question;
  } catch (err) {
    console.error(`    Error: ${err.message.slice(0, 80)}`);
    return null;
  }
}

async function uploadToDb(subtopic, question, lang, qtype) {
  const questionJson = JSON.stringify(question).replace(/'/g, "''");
  const id = `qb_math_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  
  const sql = `INSERT INTO question_bank (id, subject, topic_key, language, qtype, difficulty, question_json, status, kb_backend, rewrite_mode, llm_model) VALUES ('${id}', 'Mathematics', '${subtopic.id}', '${lang}', '${qtype}', 3, '${questionJson}', 'ready', 'none', 0, 'gpt-4o-mini');`;
  
  const tempFile = path.join(__dirname, 'temp-insert.sql');
  fs.writeFileSync(tempFile, sql);
  
  try {
    execSync(`npx wrangler d1 execute hkdse-physics-tutor-db --remote --file="${tempFile}"`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log('🚀 Filling all missing math questions...');
  console.log(`📊 ${ALL_SUBTOPICS.length} subtopics × ${QUESTION_TYPES.length} types = ${ALL_SUBTOPICS.length * QUESTION_TYPES.length} questions to generate\n`);
  
  let totalSuccess = 0;
  let totalFail = 0;
  
  for (let i = 0; i < ALL_SUBTOPICS.length; i++) {
    const subtopic = ALL_SUBTOPICS[i];
    console.log(`\n[${i + 1}/${ALL_SUBTOPICS.length}] ${subtopic.id} - ${subtopic.name}`);
    
    for (const qt of QUESTION_TYPES) {
      process.stdout.write(`  ${qt.label}... `);
      
      // Try up to 2 times
      let success = false;
      for (let attempt = 1; attempt <= 2 && !success; attempt++) {
        const question = await generateQuestion(subtopic, qt.lang, qt.qtype);
        if (question) {
          const uploaded = await uploadToDb(subtopic, question, qt.lang, qt.qtype);
          if (uploaded) {
            console.log('✅');
            totalSuccess++;
            success = true;
          }
        }
        if (!success && attempt < 2) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      if (!success) {
        console.log('❌');
        totalFail++;
      }
      
      // Small delay between requests
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  // Cleanup
  try { fs.unlinkSync(path.join(__dirname, 'temp-insert.sql')); } catch {}
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Complete: ${totalSuccess} success, ${totalFail} failed`);
  console.log(`📊 Total Math questions: ${52 + totalSuccess}`);
}

main().catch(console.error);

