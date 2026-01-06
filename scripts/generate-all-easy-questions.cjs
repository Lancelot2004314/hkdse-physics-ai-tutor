/**
 * Generate Easy Questions for ALL Skill Nodes
 * Creates difficulty 1-2 questions for beginner-friendly learning
 * 
 * Generates:
 * - 5 difficulty-1 questions per node (basic recall/definition)
 * - 3 difficulty-2 questions per node (simple calculation)
 * 
 * Total: ~560 new easy questions for 70 nodes
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-5-mini'; // Cost-effective for bulk generation

// All skill nodes from skillTreeConfigDetailed.js
const ALL_NODES = [
  // Unit 1: Heat and Gases (10 nodes)
  { id: 'heat-1a-1', name: 'Temperature Scales', name_zh: '溫標', topics: ['Celsius scale', 'Kelvin scale', 'absolute zero', 'temperature conversion'] },
  { id: 'heat-1a-2', name: 'Heat and Internal Energy', name_zh: '熱量與內能', topics: ['heat', 'internal energy', 'thermal energy', 'molecular motion'] },
  { id: 'heat-1a-3', name: 'Specific Heat Capacity', name_zh: '比熱容量', topics: ['Q = mcΔT', 'specific heat capacity', 'heat calculation'] },
  { id: 'heat-1b-1', name: 'Conduction', name_zh: '傳導', topics: ['thermal conduction', 'conductors', 'insulators', 'heat transfer'] },
  { id: 'heat-1b-2', name: 'Convection', name_zh: '對流', topics: ['convection currents', 'fluid motion', 'hot air rises'] },
  { id: 'heat-1b-3', name: 'Radiation', name_zh: '輻射', topics: ['thermal radiation', 'infrared', 'emission', 'absorption'] },
  { id: 'heat-1c-1', name: 'States of Matter', name_zh: '物質狀態', topics: ['solid', 'liquid', 'gas', 'melting', 'boiling'] },
  { id: 'heat-1c-2', name: 'Latent Heat', name_zh: '潛熱', topics: ['latent heat of fusion', 'latent heat of vaporization', 'Q = mL'] },
  { id: 'heat-1d-1', name: 'Gas Laws', name_zh: '氣體定律', topics: ["Boyle's law", "Charles's law", 'pressure law'] },
  { id: 'heat-1d-2', name: 'Ideal Gas Equation', name_zh: '理想氣體方程', topics: ['pV = nRT', 'ideal gas', 'molar gas constant'] },

  // Unit 2: Force and Motion (19 nodes)
  { id: 'motion-2a-1', name: 'Distance and Displacement', name_zh: '距離與位移', topics: ['distance', 'displacement', 'scalar', 'vector'] },
  { id: 'motion-2a-2', name: 'Speed and Velocity', name_zh: '速率與速度', topics: ['speed', 'velocity', 'average speed', 'instantaneous velocity'] },
  { id: 'motion-2a-3', name: 'Acceleration', name_zh: '加速度', topics: ['acceleration', 'a = (v-u)/t', 'deceleration'] },
  { id: 'motion-2a-4', name: 'Equations of Motion', name_zh: '運動方程式', topics: ['v = u + at', 's = ut + ½at²', 'v² = u² + 2as'] },
  { id: 'motion-2b-1', name: 'Types of Forces', name_zh: '力的種類', topics: ['weight', 'friction', 'tension', 'normal force'] },
  { id: 'motion-2b-2', name: "Newton's First Law", name_zh: '牛頓第一定律', topics: ['inertia', 'equilibrium', 'balanced forces'] },
  { id: 'motion-2b-3', name: "Newton's Second Law", name_zh: '牛頓第二定律', topics: ['F = ma', 'net force', 'acceleration'] },
  { id: 'motion-2b-4', name: "Newton's Third Law", name_zh: '牛頓第三定律', topics: ['action-reaction', 'equal and opposite'] },
  { id: 'motion-2c-1', name: 'Projectile Motion Basics', name_zh: '拋體運動基礎', topics: ['horizontal motion', 'vertical motion', 'independence'] },
  { id: 'motion-2c-2', name: 'Projectile Calculations', name_zh: '拋體運動計算', topics: ['range', 'maximum height', 'time of flight'] },
  { id: 'motion-2d-1', name: 'Work Done', name_zh: '作功', topics: ['W = Fs', 'work', 'joule'] },
  { id: 'motion-2d-2', name: 'Kinetic and Potential Energy', name_zh: '動能與勢能', topics: ['KE = ½mv²', 'PE = mgh', 'gravitational PE'] },
  { id: 'motion-2d-3', name: 'Conservation of Energy', name_zh: '能量守恆', topics: ['energy conservation', 'energy transformation'] },
  { id: 'motion-2d-4', name: 'Power', name_zh: '功率', topics: ['P = W/t', 'P = Fv', 'watt'] },
  { id: 'motion-2e-1', name: 'Momentum', name_zh: '動量', topics: ['p = mv', 'momentum', 'kg m/s'] },
  { id: 'motion-2e-2', name: 'Impulse', name_zh: '衝量', topics: ['J = Ft', 'impulse', 'change in momentum'] },
  { id: 'motion-2e-3', name: 'Conservation of Momentum', name_zh: '動量守恆', topics: ['collision', 'explosion', 'momentum before = after'] },
  { id: 'motion-2f-1', name: 'Circular Motion', name_zh: '圓周運動', topics: ['centripetal force', 'centripetal acceleration'] },
  { id: 'motion-2g-1', name: 'Gravitational Field', name_zh: '重力場', topics: ['gravitational force', 'F = Gm1m2/r²'] },

  // Unit 3: Wave Motion (10 nodes)
  { id: 'wave-3a-1', name: 'Wave Properties', name_zh: '波的特性', topics: ['wavelength', 'frequency', 'amplitude', 'period'] },
  { id: 'wave-3a-2', name: 'Transverse and Longitudinal', name_zh: '橫波與縱波', topics: ['transverse wave', 'longitudinal wave', 'compression', 'rarefaction'] },
  { id: 'wave-3a-3', name: 'Wave Equation', name_zh: '波動方程', topics: ['v = fλ', 'wave speed', 'frequency'] },
  { id: 'wave-3a-4', name: 'Wave Phenomena', name_zh: '波動現象', topics: ['reflection', 'refraction', 'diffraction'] },
  { id: 'wave-3b-1', name: 'Reflection of Light', name_zh: '光的反射', topics: ['angle of incidence', 'angle of reflection', 'plane mirror'] },
  { id: 'wave-3b-2', name: 'Refraction of Light', name_zh: '光的折射', topics: ["Snell's law", 'refractive index', 'total internal reflection'] },
  { id: 'wave-3b-3', name: 'Lenses', name_zh: '透鏡', topics: ['converging lens', 'diverging lens', 'focal length'] },
  { id: 'wave-3c-1', name: 'Sound Waves', name_zh: '聲波', topics: ['sound production', 'sound propagation', 'medium'] },
  { id: 'wave-3c-2', name: 'Sound Properties', name_zh: '聲音特性', topics: ['pitch', 'loudness', 'frequency', 'amplitude'] },
  { id: 'wave-3c-3', name: 'Resonance', name_zh: '共振', topics: ['resonance', 'natural frequency', 'stationary wave'] },

  // Unit 4: Electricity and Magnetism (12 nodes)
  { id: 'em-4a-1', name: 'Electric Charge', name_zh: '電荷', topics: ['positive charge', 'negative charge', 'charging', 'electron'] },
  { id: 'em-4a-2', name: 'Electric Field', name_zh: '電場', topics: ['electric field lines', 'field strength', 'point charge'] },
  { id: 'em-4a-3', name: 'Electric Potential', name_zh: '電勢', topics: ['potential difference', 'voltage', 'volt'] },
  { id: 'em-4b-1', name: 'Current and Resistance', name_zh: '電流與電阻', topics: ['I = Q/t', 'V = IR', "Ohm's law", 'resistance'] },
  { id: 'em-4b-2', name: 'Series and Parallel', name_zh: '串聯與並聯', topics: ['series circuit', 'parallel circuit', 'total resistance'] },
  { id: 'em-4b-3', name: 'Electrical Power', name_zh: '電功率', topics: ['P = IV', 'P = I²R', 'P = V²/R', 'watt'] },
  { id: 'em-4b-4', name: 'Domestic Circuits', name_zh: '家居電路', topics: ['fuse', 'circuit breaker', 'earthing', 'safety'] },
  { id: 'em-4c-1', name: 'Magnetic Fields', name_zh: '磁場', topics: ['magnetic field', 'field lines', 'bar magnet'] },
  { id: 'em-4c-2', name: 'Motor Effect', name_zh: '電動機效應', topics: ['force on wire', 'motor', 'Fleming left-hand rule'] },
  { id: 'em-4c-3', name: 'Electromagnetic Induction', name_zh: '電磁感應', topics: ["Faraday's law", "Lenz's law", 'induced EMF'] },
  { id: 'em-4c-4', name: 'Transformers', name_zh: '變壓器', topics: ['step-up', 'step-down', 'turns ratio'] },
  { id: 'em-4c-5', name: 'AC Circuits', name_zh: '交流電路', topics: ['AC', 'DC', 'RMS', 'peak value'] },

  // Unit 5: Radioactivity (8 nodes)
  { id: 'nuclear-5a-1', name: 'Atomic Structure', name_zh: '原子結構', topics: ['proton', 'neutron', 'electron', 'nucleus'] },
  { id: 'nuclear-5a-2', name: 'Radioactive Decay', name_zh: '放射性衰變', topics: ['alpha', 'beta', 'gamma', 'radiation'] },
  { id: 'nuclear-5a-3', name: 'Half-life', name_zh: '半衰期', topics: ['half-life', 'decay curve', 'activity'] },
  { id: 'nuclear-5b-1', name: 'Nuclear Equations', name_zh: '核方程式', topics: ['nuclear equation', 'mass number', 'atomic number'] },
  { id: 'nuclear-5b-2', name: 'Mass-Energy Equivalence', name_zh: '質能等價', topics: ['E = mc²', 'mass defect', 'binding energy'] },
  { id: 'nuclear-5c-1', name: 'Nuclear Fission', name_zh: '核裂變', topics: ['fission', 'chain reaction', 'nuclear reactor'] },
  { id: 'nuclear-5c-2', name: 'Nuclear Fusion', name_zh: '核聚變', topics: ['fusion', 'sun', 'hydrogen', 'helium'] },
  { id: 'nuclear-5c-3', name: 'Applications of Radiation', name_zh: '輻射應用', topics: ['medical use', 'carbon dating', 'tracers'] },

  // Elective: Astronomy (6 nodes)
  { id: 'astro-1', name: 'Solar System', name_zh: '太陽系', topics: ['planets', 'moons', 'orbit', 'sun'] },
  { id: 'astro-2', name: "Kepler's Laws", name_zh: '開普勒定律', topics: ["Kepler's laws", 'elliptical orbit', 'orbital period'] },
  { id: 'astro-3', name: 'Stellar Properties', name_zh: '恆星性質', topics: ['luminosity', 'temperature', 'spectral class'] },
  { id: 'astro-4', name: 'Stellar Evolution', name_zh: '恆星演化', topics: ['main sequence', 'red giant', 'supernova', 'white dwarf'] },
  { id: 'astro-5', name: 'Galaxies and Universe', name_zh: '星系與宇宙', topics: ['galaxy', 'Milky Way', 'Hubble law'] },
  { id: 'astro-6', name: 'Cosmology', name_zh: '宇宙學', topics: ['Big Bang', 'cosmic background radiation', 'expansion'] },

  // Elective: Atomic World (5 nodes)
  { id: 'atomic-1', name: 'Rutherford Model', name_zh: '盧瑟福模型', topics: ['alpha scattering', 'nucleus', 'nuclear model'] },
  { id: 'atomic-2', name: 'Bohr Model', name_zh: '玻爾模型', topics: ['energy levels', 'electron orbit', 'quantization'] },
  { id: 'atomic-3', name: 'Photoelectric Effect', name_zh: '光電效應', topics: ['photon', 'work function', 'threshold frequency'] },
  { id: 'atomic-4', name: 'Atomic Spectra', name_zh: '原子光譜', topics: ['emission spectrum', 'absorption spectrum', 'line spectrum'] },
  { id: 'atomic-5', name: 'Wave-Particle Duality', name_zh: '波粒二象性', topics: ['de Broglie wavelength', 'matter wave', 'electron diffraction'] },
];

// Question type templates
const QUESTION_TYPES = ['mc', 'fill_blank', 'short'];

async function generateQuestion(node, difficulty, qtype) {
  const typeInstructions = {
    mc: 'Multiple choice with 4 options (A, B, C, D). Include "options" array in response.',
    fill_blank: 'Fill in the blank question. Use _____ for the blank. Include "blanks" array with correct answers.',
    short: 'Short answer question requiring 1-2 sentence response.'
  };

  const difficultyDesc = difficulty === 1 
    ? 'VERY EASY - basic definition, recall, or identification. A complete beginner should answer correctly.'
    : 'EASY - simple one-step calculation or comparison. Requires basic understanding.';

  const prompt = `You are a DSE Physics question generator creating questions for Hong Kong students.

Topic: ${node.name} (${node.name_zh})
Related concepts: ${node.topics.join(', ')}
Question type: ${qtype}
Difficulty: ${difficulty}/5 - ${difficultyDesc}

Requirements:
1. Question MUST be in Traditional Chinese (繁體中文)
2. Question must be APPROPRIATE FOR BEGINNERS
3. ${typeInstructions[qtype]}
4. Include clear, educational explanation in Chinese
5. For calculations, use simple whole numbers

Return JSON:
{
  "qtype": "${qtype}",
  "question": "題目內容（繁體中文）",
  ${qtype === 'mc' ? '"options": ["A選項", "B選項", "C選項", "D選項"],' : ''}
  ${qtype === 'fill_blank' ? '"blanks": ["答案"],' : ''}
  "answer": "正確答案",
  "explanation": "詳細解釋（繁體中文）"
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
      console.error(`  ❌ API Error: ${data.error.message}`);
      return null;
    }

    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function insertQuestion(question, nodeId, difficulty) {
  const id = `easy-${nodeId}-d${difficulty}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  let content;
  if (question.qtype === 'mc') {
    content = JSON.stringify({
      question: question.question,
      options: question.options || []
    });
  } else if (question.qtype === 'fill_blank') {
    content = JSON.stringify({
      question: question.question,
      blanks: question.blanks || [question.answer]
    });
  } else {
    content = JSON.stringify({
      question: question.question
    });
  }

  const sql = `INSERT INTO question_bank (id, topic_key, qtype, year, paper, question_number, content, answer, explanation, difficulty, calibrated_difficulty, skill_node_id) 
    VALUES ('${id}', 'physics-learn', '${question.qtype}', 2025, 'generated', 'easy', 
    '${content.replace(/'/g, "''")}', 
    '${(question.answer || '').replace(/'/g, "''")}', 
    '${(question.explanation || '').replace(/'/g, "''")}', 
    ${difficulty}, ${difficulty}, '${nodeId}');`;

  try {
    await execAsync(`cd "/Users/lance/new project/hkdse-physics-ai-tutor" && npx wrangler d1 execute hkdse-physics-tutor-db --remote --command="${sql.replace(/"/g, '\\"')}"`);
    return true;
  } catch (error) {
    console.error(`  ❌ DB Error: ${error.message.slice(0, 100)}`);
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  console.log('🚀 Generating easy questions for ALL skill nodes...');
  console.log(`📚 Total nodes: ${ALL_NODES.length}`);
  console.log(`📝 Questions per node: 5 (diff 1) + 3 (diff 2) = 8`);
  console.log(`🎯 Expected total: ~${ALL_NODES.length * 8} questions\n`);
  
  let totalGenerated = 0;
  let totalFailed = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < ALL_NODES.length; i++) {
    const node = ALL_NODES[i];
    console.log(`\n[${i + 1}/${ALL_NODES.length}] 📚 ${node.name} (${node.name_zh})`);
    
    // Generate 5 difficulty-1 questions (mix of types)
    for (let j = 0; j < 5; j++) {
      const qtype = QUESTION_TYPES[j % QUESTION_TYPES.length];
      process.stdout.write(`  D1 ${qtype} ${j + 1}/5... `);
      const q = await generateQuestion(node, 1, qtype);
      if (q) {
        const inserted = await insertQuestion(q, node.id, 1);
        if (inserted) {
          console.log('✅');
          totalGenerated++;
        } else {
          console.log('⚠️ DB fail');
          totalFailed++;
        }
      } else {
        console.log('❌ API fail');
        totalFailed++;
      }
      await sleep(500); // Rate limiting
    }
    
    // Generate 3 difficulty-2 questions (mix of types)
    for (let j = 0; j < 3; j++) {
      const qtype = QUESTION_TYPES[j % QUESTION_TYPES.length];
      process.stdout.write(`  D2 ${qtype} ${j + 1}/3... `);
      const q = await generateQuestion(node, 2, qtype);
      if (q) {
        const inserted = await insertQuestion(q, node.id, 2);
        if (inserted) {
          console.log('✅');
          totalGenerated++;
        } else {
          console.log('⚠️ DB fail');
          totalFailed++;
        }
      } else {
        console.log('❌ API fail');
        totalFailed++;
      }
      await sleep(500); // Rate limiting
    }
    
    // Progress report every 10 nodes
    if ((i + 1) % 10 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
      console.log(`\n📊 Progress: ${i + 1}/${ALL_NODES.length} nodes, ${totalGenerated} questions, ${elapsed} min elapsed`);
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);
  console.log(`\n\n✨ DONE!`);
  console.log(`📊 Generated: ${totalGenerated} questions`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`⏱️ Time: ${totalTime} minutes`);
}

main().catch(console.error);


