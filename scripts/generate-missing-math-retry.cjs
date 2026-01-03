/**
 * Retry generating missing math questions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Only the 3 that failed
const MISSING_SUBTOPICS = [
  { id: 'math_geo_7', name: '三維圖形的體積與表面積', nameEn: 'Volume and Surface Area of 3D Figures', category: '度量、圖形與空間' },
  { id: 'math_trig_4', name: '解三角形', nameEn: 'Solving Triangles', category: '三角學' },
  { id: 'math_m1_6', name: '離散隨機變量', nameEn: 'Discrete Random Variables', category: 'M1 微積分與統計' },
];

const MATH_MC_PROMPT = `你是一位專業的HKDSE數學科出題員。請根據以下主題生成1道高質量的HKDSE數學選擇題。

主題：{topic}
類別：{category}

要求：
1. 題目必須符合HKDSE數學科考試風格和難度
2. 使用繁體中文出題
3. 數學公式使用 LaTeX 格式（用 $ 包圍），注意轉義字符
4. 提供4個選項 (A, B, C, D)
5. 確保答案正確且有詳細解釋
6. JSON 中的反斜線要雙重轉義 (例如 \\\\frac 而不是 \\frac)

請以純JSON格式回覆（不要用markdown代碼塊包圍）：
{"question":"題目","options":["A. 選項1","B. 選項2","C. 選項3","D. 選項4"],"correctAnswer":"A","explanation":"解釋","topic":"{topicId}","score":1}`;

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
          { role: 'system', content: '你是HKDSE數學科專業出題員。只回覆有效的JSON，不要使用markdown代碼塊。確保所有LaTeX反斜線都正確雙重轉義。' },
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
    let content = data.choices?.[0]?.message?.content || '';
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Try to fix common JSON issues
    content = content.replace(/\n/g, ' ').trim();
    
    const question = JSON.parse(content);
    question.topic = subtopic.id;
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
    console.error(`DB insert failed:`, err.message.slice(0, 100));
    return false;
  }
}

async function main() {
  console.log('🔄 Retrying failed questions...\n');
  
  let successCount = 0;
  
  for (const subtopic of MISSING_SUBTOPICS) {
    console.log(`📝 Generating: ${subtopic.id} - ${subtopic.name}...`);
    
    // Try up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      const question = await generateQuestion(subtopic);
      if (question) {
        const uploaded = await uploadToDb(subtopic, question);
        if (uploaded) {
          console.log(`   ✅ Success (attempt ${attempt})\n`);
          successCount++;
          break;
        }
      }
      if (attempt < 3) {
        console.log(`   ⚠️ Attempt ${attempt} failed, retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.log(`   ❌ All attempts failed\n`);
      }
    }
  }
  
  try { fs.unlinkSync(path.join(__dirname, 'temp-insert.sql')); } catch {}
  
  console.log(`\n📊 Complete: ${successCount}/3 success`);
}

main().catch(console.error);

