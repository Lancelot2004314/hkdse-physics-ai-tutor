/**
 * Generate missing math questions for specific subtopics
 * Run: OPENAI_API_KEY=xxx node scripts/generate-missing-math.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

// Missing subtopics that need questions
const MISSING_SUBTOPICS = [
  { id: 'math_na_3', name: '因式分解', nameEn: 'Factorization', category: '數與代數' },
  { id: 'math_na_7', name: '等差數列與等比數列', nameEn: 'Arithmetic and Geometric Sequences', category: '數與代數' },
  { id: 'math_geo_7', name: '三維圖形的體積與表面積', nameEn: 'Volume and Surface Area of 3D Figures', category: '度量、圖形與空間' },
  { id: 'math_trig_4', name: '解三角形', nameEn: 'Solving Triangles', category: '三角學' },
  { id: 'math_m1_3', name: '微分的應用', nameEn: 'Applications of Differentiation', category: 'M1 微積分與統計' },
  { id: 'math_m1_6', name: '離散隨機變量', nameEn: 'Discrete Random Variables', category: 'M1 微積分與統計' },
  { id: 'math_m2_1', name: '數學歸納法', nameEn: 'Mathematical Induction', category: 'M2 代數與微積分' },
];

const MATH_MC_PROMPT = `你是一位專業的HKDSE數學科出題員。請根據以下主題生成1道高質量的HKDSE數學選擇題。

主題：{topic}
類別：{category}

要求：
1. 題目必須符合HKDSE數學科考試風格和難度
2. 使用繁體中文出題
3. 數學公式使用 LaTeX 格式（用 $ 包圍）
4. 提供4個選項 (A, B, C, D)
5. 確保答案正確且有詳細解釋

請以JSON格式回覆：
{
  "question": "題目內容（包含LaTeX公式）",
  "options": ["A. 選項1", "B. 選項2", "C. 選項3", "D. 選項4"],
  "correctAnswer": "A/B/C/D",
  "explanation": "詳細解題過程",
  "topic": "{topicId}",
  "score": 1
}`;

async function generateQuestion(subtopic) {
  const prompt = MATH_MC_PROMPT
    .replace('{topic}', `${subtopic.name} (${subtopic.nameEn})`)
    .replace('{category}', subtopic.category)
    .replace('{topicId}', subtopic.id);

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
          { role: 'system', content: '你是HKDSE數學科專業出題員，擅長出高質量的選擇題。請只回覆JSON格式。' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const question = JSON.parse(jsonMatch[0]);
    question.topic = subtopic.id; // Ensure correct topic ID
    return question;
  } catch (err) {
    console.error(`Error generating ${subtopic.id}:`, err.message);
    return null;
  }
}

async function uploadToDb(subtopic, question) {
  const questionJson = JSON.stringify(question).replace(/'/g, "''");
  const id = `qb_math_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  
  const sql = `INSERT INTO question_bank (id, subject, topic_key, language, qtype, difficulty, question_json, status, kb_backend, rewrite_mode, llm_model) VALUES ('${id}', 'Mathematics', '${subtopic.id}', 'zh', 'mc', 3, '${questionJson}', 'ready', 'none', 0, 'gpt-4o-mini');`;
  
  const tempFile = path.join(__dirname, 'temp-insert.sql');
  fs.writeFileSync(tempFile, sql);
  
  try {
    execSync(`npx wrangler d1 execute hkdse-physics-tutor-db --remote --file="${tempFile}"`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    return true;
  } catch (err) {
    console.error(`DB insert failed for ${subtopic.id}:`, err.message.slice(0, 100));
    return false;
  }
}

async function main() {
  console.log('🚀 Generating missing math questions...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const subtopic of MISSING_SUBTOPICS) {
    console.log(`📝 Generating: ${subtopic.id} - ${subtopic.name}...`);
    
    const question = await generateQuestion(subtopic);
    if (!question) {
      console.log(`   ❌ Failed to generate\n`);
      failCount++;
      continue;
    }
    
    console.log(`   ✅ Generated, uploading to DB...`);
    
    const uploaded = await uploadToDb(subtopic, question);
    if (uploaded) {
      console.log(`   ✅ Uploaded successfully\n`);
      successCount++;
    } else {
      console.log(`   ❌ Upload failed\n`);
      failCount++;
    }
    
    // Delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Cleanup
  try {
    fs.unlinkSync(path.join(__dirname, 'temp-insert.sql'));
  } catch {}
  
  console.log(`\n📊 Complete: ${successCount} success, ${failCount} failed`);
}

main().catch(console.error);

