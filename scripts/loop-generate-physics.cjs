/**
 * Loop generate physics questions for 5 hours
 * Automatically cycles through all topics repeatedly
 * Run: OPENAI_API_KEY=xxx node scripts/loop-generate-physics.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ Please set OPENAI_API_KEY environment variable');
  process.exit(1);
}

// Duration: 5 hours in milliseconds
const DURATION_MS = 5 * 60 * 60 * 1000;
const START_TIME = Date.now();

// All 20 Physics subtopics
const ALL_SUBTOPICS = [
  // Heat and Gases (4)
  { id: 'heat_1', name: '溫度、熱及內能', nameEn: 'Temperature, Heat and Internal Energy' },
  { id: 'heat_2', name: '傳導、對流、輻射', nameEn: 'Conduction, Convection and Radiation' },
  { id: 'heat_3', name: '物態轉變與潛熱', nameEn: 'Change of State and Latent Heat' },
  { id: 'heat_4', name: '氣體定律與動理學理論', nameEn: 'Gas Laws and Kinetic Theory' },
  // Mechanics (6)
  { id: 'mech_1', name: '位移與運動學', nameEn: 'Displacement and Kinematics' },
  { id: 'mech_2', name: '牛頓定律', nameEn: "Newton's Laws" },
  { id: 'mech_3', name: '拋體運動', nameEn: 'Projectile Motion' },
  { id: 'mech_4', name: '作功、能量和功率', nameEn: 'Work, Energy and Power' },
  { id: 'mech_5', name: '動量', nameEn: 'Momentum' },
  { id: 'mech_6', name: '圓周運動與重力', nameEn: 'Circular Motion and Gravitation' },
  // Waves (3)
  { id: 'wave_1', name: '波的本質和特性', nameEn: 'Nature and Properties of Waves' },
  { id: 'wave_2', name: '光的反射、折射、繞射與透鏡', nameEn: 'Reflection, Refraction, Diffraction and Lenses' },
  { id: 'wave_3', name: '聲波', nameEn: 'Sound Waves' },
  // Electricity and Magnetism (4)
  { id: 'elec_1', name: '靜電學', nameEn: 'Electrostatics' },
  { id: 'elec_2', name: '電路', nameEn: 'Electric Circuits' },
  { id: 'elec_3', name: '電磁感應', nameEn: 'Electromagnetic Induction' },
  { id: 'elec_4', name: '交流電', nameEn: 'Alternating Current' },
  // Radioactivity (3)
  { id: 'radio_1', name: '放射性衰變', nameEn: 'Radioactive Decay' },
  { id: 'radio_2', name: '核反應', nameEn: 'Nuclear Reactions' },
  { id: 'radio_3', name: '核能應用', nameEn: 'Applications of Nuclear Energy' },
];

// 6 question types
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
    en: `HKDSE Physics MC for {topic}. Use physics formulas with LaTeX ($...$). JSON only: {"question":"","options":["A.","B.","C.","D."],"correctAnswer":"A","explanation":"","topic":"{id}","score":1}`,
    zh: `HKDSE物理選擇題「{nameZh}」。物理公式用LaTeX($...$)。只回JSON: {"question":"","options":["A.","B.","C.","D."],"correctAnswer":"A","explanation":"","topic":"{id}","score":1}`
  },
  short: {
    en: `HKDSE Physics short question (4-6 marks) for {topic}. Use LaTeX for formulas. JSON: {"question":"","modelAnswer":"","markingScheme":["1M","2M"],"topic":"{id}","totalMarks":4}`,
    zh: `HKDSE物理簡答題(4-6分)「{nameZh}」。公式用LaTeX。JSON: {"question":"","modelAnswer":"","markingScheme":["1分","2分"],"topic":"{id}","totalMarks":4}`
  },
  long: {
    en: `HKDSE Physics long question (8-12 marks, 2-3 parts) for {topic}. Use LaTeX. JSON: {"question":"","parts":[{"part":"a","question":"","marks":3,"modelAnswer":""},{"part":"b","question":"","marks":4,"modelAnswer":""}],"topic":"{id}","totalMarks":10}`,
    zh: `HKDSE物理長題目(8-12分,2-3部分)「{nameZh}」。公式用LaTeX。JSON: {"question":"","parts":[{"part":"a","question":"","marks":3,"modelAnswer":""},{"part":"b","question":"","marks":4,"modelAnswer":""}],"topic":"{id}","totalMarks":10}`
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
          { role: 'system', content: 'Valid JSON only. No markdown. Escape LaTeX backslashes properly.' },
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
  const id = `qb_phy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const sql = `INSERT INTO question_bank (id,subject,topic_key,language,qtype,difficulty,question_json,status,kb_backend,rewrite_mode,llm_model) VALUES ('${id}','Physics','${subtopic.id}','${lang}','${qtype}',3,'${json}','ready','none',0,'gpt-4o-mini');`;
  fs.writeFileSync(path.join(__dirname, 'temp-phy.sql'), sql);
  try {
    execSync(`npx wrangler d1 execute hkdse-physics-tutor-db --remote --file="${path.join(__dirname, 'temp-phy.sql')}"`, { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
    return true;
  } catch { return false; }
}

async function main() {
  console.log('🔬 PHYSICS LOOP GENERATE - Running for 5 hours');
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
    
    // Shuffle subtopics for variety
    const shuffled = [...ALL_SUBTOPICS].sort(() => Math.random() - 0.5);
    
    for (const sub of shuffled) {
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
      
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`\n📊 Round ${round}: ${roundSuccess}✓ ${roundFail}✗ | Total: ${totalSuccess}✓ ${totalFail}✗`);
  }
  
  try { fs.unlinkSync(path.join(__dirname, 'temp-phy.sql')); } catch {}
  
  console.log('\n' + '═'.repeat(50));
  console.log(`🏁 PHYSICS FINISHED after ${round} rounds`);
  console.log(`📊 Total: ${totalSuccess} success, ${totalFail} failed`);
}

main();






