/**
 * Generate Easy Questions for Beginners
 * Creates difficulty 1-2 questions for each skill node
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-5-mini'; // Cost-effective for bulk generation

// Skill nodes with their topics (first few nodes per unit for beginners)
const BEGINNER_NODES = [
  // Unit 1: Heat and Gases
  { id: 'heat-1a-1', name: 'Temperature Scales', name_zh: '溫標', topics: ['Celsius', 'Kelvin', 'temperature conversion'] },
  { id: 'heat-1a-2', name: 'Heat Capacity', name_zh: '熱容量', topics: ['heat capacity definition', 'Q=mcΔT basic'] },
  { id: 'heat-1b-1', name: 'Conduction', name_zh: '傳導', topics: ['thermal conduction', 'conductors', 'insulators'] },
  
  // Unit 2: Force and Motion  
  { id: 'motion-2a-1', name: 'Position, Distance, Displacement', name_zh: '位置、距離、位移', topics: ['distance vs displacement', 'position'] },
  { id: 'motion-2a-2', name: 'Speed and Velocity', name_zh: '速率與速度', topics: ['speed definition', 'velocity', 'average speed'] },
  { id: 'motion-2a-3', name: 'Acceleration', name_zh: '加速度', topics: ['acceleration definition', 'a=(v-u)/t'] },
  
  // Unit 3: Wave Motion
  { id: 'wave-3a-1', name: 'Wave Properties', name_zh: '波的性質', topics: ['wavelength', 'frequency', 'amplitude', 'period'] },
  { id: 'wave-3a-2', name: 'Wave Speed', name_zh: '波速', topics: ['v=fλ', 'wave speed calculation'] },
  
  // Unit 4: Electricity and Magnetism
  { id: 'em-4a-1', name: 'Electric Charges', name_zh: '電荷', topics: ['positive charge', 'negative charge', 'charging methods'] },
  { id: 'em-4a-2', name: 'Electric Field', name_zh: '電場', topics: ['electric field definition', 'field lines'] },
  { id: 'em-4b-1', name: 'Current and Voltage', name_zh: '電流與電壓', topics: ['current definition', 'voltage definition', 'I=Q/t'] },
  { id: 'em-4b-2', name: 'Resistance and Ohms Law', name_zh: '電阻與歐姆定律', topics: ['V=IR', 'resistance'] },
  
  // Unit 5: Radioactivity and Nuclear Energy
  { id: 'nuclear-5a-1', name: 'Atomic Structure', name_zh: '原子結構', topics: ['protons', 'neutrons', 'electrons', 'atomic number'] },
  { id: 'nuclear-5a-2', name: 'Radioactive Decay', name_zh: '放射性衰變', topics: ['alpha decay', 'beta decay', 'gamma radiation'] },
];

// Question templates for difficulty 1 (basic recall/definition)
const DIFFICULTY_1_PROMPTS = [
  "Generate a simple definition question asking what {topic} is",
  "Generate a true/false style MC question about basic facts of {topic}",
  "Generate an MC question identifying examples of {topic}",
  "Generate a fill-in-the-blank question about the definition of {topic}",
];

// Question templates for difficulty 2 (simple one-step calculation)
const DIFFICULTY_2_PROMPTS = [
  "Generate a simple one-step calculation using {formula}",
  "Generate an MC question requiring simple substitution into {formula}",
  "Generate a question converting units related to {topic}",
];

async function generateQuestion(node, difficulty) {
  const prompt = `You are a DSE Physics question generator. Generate a SIMPLE ${difficulty === 1 ? 'definition/recall' : 'one-step calculation'} question for Hong Kong DSE Physics students.

Topic: ${node.name} (${node.name_zh})
Related concepts: ${node.topics.join(', ')}
Difficulty: ${difficulty}/5 (${difficulty === 1 ? 'Very Easy - basic recall' : 'Easy - simple one-step'})

Requirements:
- Question must be appropriate for BEGINNERS
- ${difficulty === 1 ? 'Ask about definitions, facts, or identification' : 'Require only ONE simple calculation step'}
- Use Chinese (Traditional) for the question
- For MC questions, provide 4 options (A, B, C, D)
- Include a clear, educational explanation

Return JSON format:
{
  "qtype": "mc" | "short" | "fill_blank",
  "question": "題目內容",
  "options": ["A選項", "B選項", "C選項", "D選項"] (for MC only),
  "answer": "正確答案",
  "explanation": "詳細解釋",
  "blanks": ["答案1"] (for fill_blank only)
}

Generate ONE question now:`;

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
      console.error('API Error:', data.error);
      return null;
    }

    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error generating question:', error);
    return null;
  }
}

async function insertQuestion(question, nodeId, difficulty) {
  const id = `easy-${nodeId}-d${difficulty}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  let content;
  if (question.qtype === 'mc') {
    content = JSON.stringify({
      question: question.question,
      options: question.options
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
    console.log(`✅ Inserted: ${id}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to insert: ${error.message}`);
    return false;
  }
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  console.log('🚀 Generating easy questions for beginners...\n');
  
  let totalGenerated = 0;
  
  for (const node of BEGINNER_NODES) {
    console.log(`\n📚 Node: ${node.name} (${node.name_zh})`);
    
    // Generate 3 difficulty-1 questions and 2 difficulty-2 questions per node
    for (let i = 0; i < 3; i++) {
      console.log(`  Generating difficulty 1 question ${i + 1}/3...`);
      const q1 = await generateQuestion(node, 1);
      if (q1) {
        await insertQuestion(q1, node.id, 1);
        totalGenerated++;
      }
    }
    
    for (let i = 0; i < 2; i++) {
      console.log(`  Generating difficulty 2 question ${i + 1}/2...`);
      const q2 = await generateQuestion(node, 2);
      if (q2) {
        await insertQuestion(q2, node.id, 2);
        totalGenerated++;
      }
    }
  }

  console.log(`\n✨ Done! Generated ${totalGenerated} easy questions.`);
}

main().catch(console.error);

