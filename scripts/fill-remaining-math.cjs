/**
 * Continue filling remaining math questions (M1 and M2)
 * Run: OPENAI_API_KEY=xxx node scripts/fill-remaining-math.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.error('❌ Please set OPENAI_API_KEY environment variable');
    process.exit(1);
}

// Remaining subtopics (M1 from 4 onwards + all M2)
const REMAINING_SUBTOPICS = [
    // M1 (remaining)
    { id: 'math_m1_4', name: '積分', nameEn: 'Integration', category: 'M1 微積分與統計' },
    { id: 'math_m1_5', name: '定積分的應用', nameEn: 'Applications of Definite Integration', category: 'M1 微積分與統計' },
    { id: 'math_m1_6', name: '離散隨機變量', nameEn: 'Discrete Random Variables', category: 'M1 微積分與統計' },
    { id: 'math_m1_7', name: '二項分佈', nameEn: 'Binomial Distribution', category: 'M1 微積分與統計' },
    { id: 'math_m1_8', name: '正態分佈', nameEn: 'Normal Distribution', category: 'M1 微積分與統計' },
    { id: 'math_m1_9', name: '抽樣分佈與估計', nameEn: 'Sampling Distribution and Estimation', category: 'M1 微積分與統計' },
    // M2 (all)
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

// All 5 question types
const QUESTION_TYPES = [
    { lang: 'en', qtype: 'mc', label: 'EN-MC' },
    { lang: 'en', qtype: 'short', label: 'EN-Short' },
    { lang: 'en', qtype: 'long', label: 'EN-Long' },
    { lang: 'zh', qtype: 'short', label: 'ZH-Short' },
    { lang: 'zh', qtype: 'long', label: 'ZH-Long' },
];

const PROMPTS = {
    mc: {
        en: `You are a HKDSE Math examiner. Generate 1 MC question for: {topic}. Use LaTeX ($...$) for math. Reply JSON only: {"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correctAnswer":"A","explanation":"...","topic":"{topicId}","score":1}`,
        zh: `你是HKDSE數學出題員。為「{topicZh}」出1道選擇題。用LaTeX($...$)。只回JSON: {"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correctAnswer":"A","explanation":"...","topic":"{topicId}","score":1}`
    },
    short: {
        en: `You are a HKDSE Math examiner. Generate 1 short answer question (4-6 marks) for: {topic}. Use LaTeX. Reply JSON only: {"question":"...","modelAnswer":"...","markingScheme":["1M for...","2M for..."],"topic":"{topicId}","totalMarks":4}`,
        zh: `你是HKDSE數學出題員。為「{topicZh}」出1道簡答題(4-6分)。用LaTeX。只回JSON: {"question":"...","modelAnswer":"...","markingScheme":["步驟1得1分","步驟2得2分"],"topic":"{topicId}","totalMarks":4}`
    },
    long: {
        en: `You are a HKDSE Math examiner. Generate 1 long question with 2-3 parts (8-12 marks) for: {topic}. Use LaTeX. Reply JSON only: {"question":"...","parts":[{"part":"a","question":"...","marks":3,"modelAnswer":"..."},{"part":"b","question":"...","marks":4,"modelAnswer":"..."}],"topic":"{topicId}","totalMarks":10}`,
        zh: `你是HKDSE數學出題員。為「{topicZh}」出1道長題目(8-12分,2-3部分)。用LaTeX。只回JSON: {"question":"...","parts":[{"part":"a","question":"...","marks":3,"modelAnswer":"..."},{"part":"b","question":"...","marks":4,"modelAnswer":"..."}],"topic":"{topicId}","totalMarks":10}`
    }
};

async function generateQuestion(subtopic, lang, qtype) {
    const prompt = PROMPTS[qtype][lang]
        .replace(/{topic}/g, subtopic.nameEn)
        .replace(/{topicZh}/g, subtopic.name)
        .replace(/{topicId}/g, subtopic.id);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Reply with valid JSON only. No markdown. Escape backslashes properly in LaTeX.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 2000,
            }),
        });

        if (!response.ok) throw new Error(`API ${response.status}`);

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '';
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        const question = JSON.parse(content);
        question.topic = subtopic.id;
        return question;
    } catch (err) {
        return null;
    }
}

async function uploadToDb(subtopic, question, lang, qtype) {
    const questionJson = JSON.stringify(question).replace(/'/g, "''");
    const id = `qb_math_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const sql = `INSERT INTO question_bank (id, subject, topic_key, language, qtype, difficulty, question_json, status, kb_backend, rewrite_mode, llm_model) VALUES ('${id}', 'Mathematics', '${subtopic.id}', '${lang}', '${qtype}', 3, '${questionJson}', 'ready', 'none', 0, 'gpt-4o-mini');`;

    fs.writeFileSync(path.join(__dirname, 'temp.sql'), sql);

    try {
        execSync(`npx wrangler d1 execute hkdse-physics-tutor-db --remote --file="${path.join(__dirname, 'temp.sql')}"`, {
            cwd: path.join(__dirname, '..'), stdio: 'pipe'
        });
        return true;
    } catch { return false; }
}

async function main() {
    console.log('🚀 Continuing to fill remaining math questions...');
    console.log(`📊 ${REMAINING_SUBTOPICS.length} subtopics × ${QUESTION_TYPES.length} types = ${REMAINING_SUBTOPICS.length * QUESTION_TYPES.length} questions\n`);

    let success = 0, fail = 0;

    for (let i = 0; i < REMAINING_SUBTOPICS.length; i++) {
        const sub = REMAINING_SUBTOPICS[i];
        process.stdout.write(`[${i + 1}/${REMAINING_SUBTOPICS.length}] ${sub.id} `);

        for (const qt of QUESTION_TYPES) {
            let ok = false;
            for (let t = 0; t < 2 && !ok; t++) {
                const q = await generateQuestion(sub, qt.lang, qt.qtype);
                if (q && await uploadToDb(sub, q, qt.lang, qt.qtype)) {
                    process.stdout.write('✓');
                    success++;
                    ok = true;
                }
                if (!ok && t === 0) await new Promise(r => setTimeout(r, 500));
            }
            if (!ok) { process.stdout.write('✗'); fail++; }
            await new Promise(r => setTimeout(r, 200));
        }
        console.log();
    }

    try { fs.unlinkSync(path.join(__dirname, 'temp.sql')); } catch { }
    console.log(`\n✅ Done: ${success} success, ${fail} failed`);
}

main();

