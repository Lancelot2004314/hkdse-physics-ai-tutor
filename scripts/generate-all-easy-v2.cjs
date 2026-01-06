/**
 * Generate Easy Questions for ALL Skill Nodes v2
 * Uses file-based SQL execution to avoid escaping issues
 */

const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-5-mini';
const PROJECT_DIR = '/Users/lance/new project/hkdse-physics-ai-tutor';

// All skill nodes
const ALL_NODES = [
  // Unit 1: Heat and Gases
  { id: 'heat-1a-1', name: 'Temperature Scales', name_zh: '溫標', topics: ['Celsius scale', 'Kelvin scale', 'absolute zero'] },
  { id: 'heat-1a-2', name: 'Heat and Internal Energy', name_zh: '熱量與內能', topics: ['heat', 'internal energy', 'thermal energy'] },
  { id: 'heat-1a-3', name: 'Specific Heat Capacity', name_zh: '比熱容量', topics: ['Q = mcΔT', 'specific heat capacity'] },
  { id: 'heat-1b-1', name: 'Conduction', name_zh: '傳導', topics: ['thermal conduction', 'conductors', 'insulators'] },
  { id: 'heat-1b-2', name: 'Convection', name_zh: '對流', topics: ['convection currents', 'fluid motion'] },
  { id: 'heat-1b-3', name: 'Radiation', name_zh: '輻射', topics: ['thermal radiation', 'infrared', 'emission'] },
  { id: 'heat-1c-1', name: 'States of Matter', name_zh: '物質狀態', topics: ['solid', 'liquid', 'gas', 'melting'] },
  { id: 'heat-1c-2', name: 'Latent Heat', name_zh: '潛熱', topics: ['latent heat of fusion', 'latent heat of vaporization'] },
  { id: 'heat-1d-1', name: 'Gas Laws', name_zh: '氣體定律', topics: ["Boyle's law", "Charles's law"] },
  { id: 'heat-1d-2', name: 'Ideal Gas Equation', name_zh: '理想氣體方程', topics: ['pV = nRT', 'ideal gas'] },

  // Unit 2: Force and Motion
  { id: 'motion-2a-1', name: 'Distance and Displacement', name_zh: '距離與位移', topics: ['distance', 'displacement', 'scalar', 'vector'] },
  { id: 'motion-2a-2', name: 'Speed and Velocity', name_zh: '速率與速度', topics: ['speed', 'velocity', 'average speed'] },
  { id: 'motion-2a-3', name: 'Acceleration', name_zh: '加速度', topics: ['acceleration', 'a = (v-u)/t'] },
  { id: 'motion-2a-4', name: 'Equations of Motion', name_zh: '運動方程式', topics: ['v = u + at', 's = ut + ½at²'] },
  { id: 'motion-2b-1', name: 'Types of Forces', name_zh: '力的種類', topics: ['weight', 'friction', 'tension', 'normal force'] },
  { id: 'motion-2b-2', name: "Newton's First Law", name_zh: '牛頓第一定律', topics: ['inertia', 'equilibrium'] },
  { id: 'motion-2b-3', name: "Newton's Second Law", name_zh: '牛頓第二定律', topics: ['F = ma', 'net force'] },
  { id: 'motion-2b-4', name: "Newton's Third Law", name_zh: '牛頓第三定律', topics: ['action-reaction'] },
  { id: 'motion-2c-1', name: 'Projectile Motion', name_zh: '拋體運動', topics: ['horizontal motion', 'vertical motion'] },
  { id: 'motion-2d-1', name: 'Work Done', name_zh: '作功', topics: ['W = Fs', 'work', 'joule'] },
  { id: 'motion-2d-2', name: 'Kinetic and Potential Energy', name_zh: '動能與勢能', topics: ['KE = ½mv²', 'PE = mgh'] },
  { id: 'motion-2d-3', name: 'Conservation of Energy', name_zh: '能量守恆', topics: ['energy conservation'] },
  { id: 'motion-2d-4', name: 'Power', name_zh: '功率', topics: ['P = W/t', 'P = Fv', 'watt'] },
  { id: 'motion-2e-1', name: 'Momentum', name_zh: '動量', topics: ['p = mv', 'momentum'] },
  { id: 'motion-2e-2', name: 'Impulse', name_zh: '衝量', topics: ['J = Ft', 'impulse'] },
  { id: 'motion-2e-3', name: 'Conservation of Momentum', name_zh: '動量守恆', topics: ['collision', 'momentum conservation'] },
  { id: 'motion-2f-1', name: 'Circular Motion', name_zh: '圓周運動', topics: ['centripetal force', 'centripetal acceleration'] },
  { id: 'motion-2g-1', name: 'Gravitational Field', name_zh: '重力場', topics: ['gravitational force', 'F = Gm1m2/r²'] },

  // Unit 3: Wave Motion
  { id: 'wave-3a-1', name: 'Wave Properties', name_zh: '波的特性', topics: ['wavelength', 'frequency', 'amplitude', 'period'] },
  { id: 'wave-3a-2', name: 'Transverse and Longitudinal', name_zh: '橫波與縱波', topics: ['transverse wave', 'longitudinal wave'] },
  { id: 'wave-3a-3', name: 'Wave Equation', name_zh: '波動方程', topics: ['v = fλ', 'wave speed'] },
  { id: 'wave-3a-4', name: 'Wave Phenomena', name_zh: '波動現象', topics: ['reflection', 'refraction', 'diffraction'] },
  { id: 'wave-3b-1', name: 'Reflection of Light', name_zh: '光的反射', topics: ['angle of incidence', 'angle of reflection'] },
  { id: 'wave-3b-2', name: 'Refraction of Light', name_zh: '光的折射', topics: ["Snell's law", 'refractive index'] },
  { id: 'wave-3b-3', name: 'Lenses', name_zh: '透鏡', topics: ['converging lens', 'diverging lens'] },
  { id: 'wave-3c-1', name: 'Sound Waves', name_zh: '聲波', topics: ['sound production', 'sound propagation'] },
  { id: 'wave-3c-2', name: 'Sound Properties', name_zh: '聲音特性', topics: ['pitch', 'loudness'] },
  { id: 'wave-3c-3', name: 'Resonance', name_zh: '共振', topics: ['resonance', 'natural frequency'] },

  // Unit 4: Electricity and Magnetism
  { id: 'em-4a-1', name: 'Electric Charge', name_zh: '電荷', topics: ['positive charge', 'negative charge', 'electron'] },
  { id: 'em-4a-2', name: 'Electric Field', name_zh: '電場', topics: ['electric field lines', 'field strength'] },
  { id: 'em-4a-3', name: 'Electric Potential', name_zh: '電勢', topics: ['potential difference', 'voltage'] },
  { id: 'em-4b-1', name: 'Current and Resistance', name_zh: '電流與電阻', topics: ['I = Q/t', 'V = IR', "Ohm's law"] },
  { id: 'em-4b-2', name: 'Series and Parallel', name_zh: '串聯與並聯', topics: ['series circuit', 'parallel circuit'] },
  { id: 'em-4b-3', name: 'Electrical Power', name_zh: '電功率', topics: ['P = IV', 'P = I²R', 'P = V²/R'] },
  { id: 'em-4b-4', name: 'Domestic Circuits', name_zh: '家居電路', topics: ['fuse', 'circuit breaker', 'earthing'] },
  { id: 'em-4c-1', name: 'Magnetic Fields', name_zh: '磁場', topics: ['magnetic field', 'field lines'] },
  { id: 'em-4c-2', name: 'Motor Effect', name_zh: '電動機效應', topics: ['force on wire', 'motor'] },
  { id: 'em-4c-3', name: 'Electromagnetic Induction', name_zh: '電磁感應', topics: ["Faraday's law", "Lenz's law"] },
  { id: 'em-4c-4', name: 'Transformers', name_zh: '變壓器', topics: ['step-up', 'step-down', 'turns ratio'] },
  { id: 'em-4c-5', name: 'AC Circuits', name_zh: '交流電路', topics: ['AC', 'DC', 'RMS'] },

  // Unit 5: Radioactivity
  { id: 'nuclear-5a-1', name: 'Atomic Structure', name_zh: '原子結構', topics: ['proton', 'neutron', 'electron', 'nucleus'] },
  { id: 'nuclear-5a-2', name: 'Radioactive Decay', name_zh: '放射性衰變', topics: ['alpha', 'beta', 'gamma'] },
  { id: 'nuclear-5a-3', name: 'Half-life', name_zh: '半衰期', topics: ['half-life', 'decay curve'] },
  { id: 'nuclear-5b-1', name: 'Nuclear Equations', name_zh: '核方程式', topics: ['nuclear equation', 'mass number'] },
  { id: 'nuclear-5b-2', name: 'Mass-Energy Equivalence', name_zh: '質能等價', topics: ['E = mc²', 'mass defect'] },
  { id: 'nuclear-5c-1', name: 'Nuclear Fission', name_zh: '核裂變', topics: ['fission', 'chain reaction'] },
  { id: 'nuclear-5c-2', name: 'Nuclear Fusion', name_zh: '核聚變', topics: ['fusion', 'sun'] },
  { id: 'nuclear-5c-3', name: 'Applications of Radiation', name_zh: '輻射應用', topics: ['medical use', 'carbon dating'] },

  // Elective: Astronomy
  { id: 'astro-1', name: 'Solar System', name_zh: '太陽系', topics: ['planets', 'moons', 'orbit'] },
  { id: 'astro-2', name: "Kepler's Laws", name_zh: '開普勒定律', topics: ["Kepler's laws", 'elliptical orbit'] },
  { id: 'astro-3', name: 'Stellar Properties', name_zh: '恆星性質', topics: ['luminosity', 'temperature'] },
  { id: 'astro-4', name: 'Stellar Evolution', name_zh: '恆星演化', topics: ['main sequence', 'red giant'] },
  { id: 'astro-5', name: 'Galaxies', name_zh: '星系', topics: ['galaxy', 'Milky Way'] },
  { id: 'astro-6', name: 'Cosmology', name_zh: '宇宙學', topics: ['Big Bang', 'cosmic background radiation'] },

  // Elective: Atomic World
  { id: 'atomic-1', name: 'Rutherford Model', name_zh: '盧瑟福模型', topics: ['alpha scattering', 'nucleus'] },
  { id: 'atomic-2', name: 'Bohr Model', name_zh: '玻爾模型', topics: ['energy levels', 'electron orbit'] },
  { id: 'atomic-3', name: 'Photoelectric Effect', name_zh: '光電效應', topics: ['photon', 'work function'] },
  { id: 'atomic-4', name: 'Atomic Spectra', name_zh: '原子光譜', topics: ['emission spectrum', 'absorption spectrum'] },
  { id: 'atomic-5', name: 'Wave-Particle Duality', name_zh: '波粒二象性', topics: ['de Broglie wavelength', 'matter wave'] },
];

const QUESTION_TYPES = ['mc', 'fill_blank', 'short'];

async function generateQuestion(node, difficulty, qtype) {
  const typeInstructions = {
    mc: 'Multiple choice with 4 options (A, B, C, D). Include "options" array.',
    fill_blank: 'Fill in the blank. Use _____ for blank. Include "blanks" array.',
    short: 'Short answer requiring 1-2 sentences.'
  };

  const diffDesc = difficulty === 1 
    ? 'VERY EASY - basic definition/recall for beginners'
    : 'EASY - simple one-step calculation';

  const prompt = `Generate a DSE Physics question for Hong Kong students.

Topic: ${node.name} (${node.name_zh})
Concepts: ${node.topics.join(', ')}
Type: ${qtype}
Difficulty: ${difficulty}/5 - ${diffDesc}

Requirements:
- Traditional Chinese (繁體中文)
- Beginner-appropriate
- ${typeInstructions[qtype]}
- Include explanation

Return JSON:
{
  "qtype": "${qtype}",
  "question": "題目（繁體中文）",
  ${qtype === 'mc' ? '"options": ["A選項", "B選項", "C選項", "D選項"],' : ''}
  ${qtype === 'fill_blank' ? '"blanks": ["答案"],' : ''}
  "answer": "正確答案",
  "explanation": "解釋"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error(`  ❌ API: ${data.error.message}`);
      return null;
    }

    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

async function insertQuestionBatch(questions) {
  if (questions.length === 0) return 0;
  
  const sqlFile = `${PROJECT_DIR}/temp-questions.sql`;
  let sql = '';
  
  for (const q of questions) {
    const id = `easy-${q.nodeId}-d${q.difficulty}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    let content;
    if (q.qtype === 'mc') {
      content = JSON.stringify({ question: q.question, options: q.options || [] });
    } else if (q.qtype === 'fill_blank') {
      content = JSON.stringify({ question: q.question, blanks: q.blanks || [q.answer] });
    } else {
      content = JSON.stringify({ question: q.question });
    }

    sql += `INSERT INTO question_bank (id, topic_key, qtype, year, paper, question_number, content, answer, explanation, difficulty, calibrated_difficulty, skill_node_id) VALUES ('${escapeSql(id)}', 'physics-learn', '${q.qtype}', 2025, 'generated', 'easy', '${escapeSql(content)}', '${escapeSql(q.answer)}', '${escapeSql(q.explanation)}', ${q.difficulty}, ${q.difficulty}, '${escapeSql(q.nodeId)}');\n`;
  }
  
  fs.writeFileSync(sqlFile, sql);
  
  try {
    await execAsync(`cd "${PROJECT_DIR}" && npx wrangler d1 execute hkdse-physics-tutor-db --remote --file=temp-questions.sql`);
    fs.unlinkSync(sqlFile);
    return questions.length;
  } catch (error) {
    console.error(`  ❌ DB batch error: ${error.message.slice(0, 100)}`);
    return 0;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Please set OPENAI_API_KEY');
    process.exit(1);
  }

  console.log('🚀 Generating easy questions for ALL skill nodes...');
  console.log(`📚 Total nodes: ${ALL_NODES.length}`);
  console.log(`📝 Questions per node: 8 (5 diff-1 + 3 diff-2)`);
  console.log(`🎯 Expected total: ~${ALL_NODES.length * 8} questions\n`);
  
  let totalGenerated = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < ALL_NODES.length; i++) {
    const node = ALL_NODES[i];
    console.log(`\n[${i + 1}/${ALL_NODES.length}] 📚 ${node.name} (${node.name_zh})`);
    
    const batch = [];
    
    // 5 difficulty-1 questions
    for (let j = 0; j < 5; j++) {
      const qtype = QUESTION_TYPES[j % QUESTION_TYPES.length];
      process.stdout.write(`  D1 ${qtype}... `);
      const q = await generateQuestion(node, 1, qtype);
      if (q) {
        batch.push({ ...q, nodeId: node.id, difficulty: 1 });
        console.log('✅');
      } else {
        console.log('❌');
      }
      await sleep(300);
    }
    
    // 3 difficulty-2 questions
    for (let j = 0; j < 3; j++) {
      const qtype = QUESTION_TYPES[j % QUESTION_TYPES.length];
      process.stdout.write(`  D2 ${qtype}... `);
      const q = await generateQuestion(node, 2, qtype);
      if (q) {
        batch.push({ ...q, nodeId: node.id, difficulty: 2 });
        console.log('✅');
      } else {
        console.log('❌');
      }
      await sleep(300);
    }
    
    // Insert batch
    if (batch.length > 0) {
      const inserted = await insertQuestionBatch(batch);
      console.log(`  💾 Inserted ${inserted} questions`);
      totalGenerated += inserted;
    }
    
    // Progress every 10 nodes
    if ((i + 1) % 10 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
      console.log(`\n📊 Progress: ${i + 1}/${ALL_NODES.length} nodes | ${totalGenerated} questions | ${elapsed} min`);
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);
  console.log(`\n\n✨ DONE!`);
  console.log(`📊 Total generated: ${totalGenerated} questions`);
  console.log(`⏱️ Time: ${totalTime} minutes`);
}

main().catch(console.error);


