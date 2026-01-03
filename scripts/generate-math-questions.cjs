/**
 * Generate one question for each Math subtopic using GPT-5-mini
 * Saves results to question_bank via API
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'https://hkdse-physics-ai-tutor.pages.dev';
const COOKIE = process.env.COOKIE || '';

// Math Topics structure (copied from mathTopics.js)
const MATH_TOPICS = {
  number_algebra: {
    id: 'number_algebra',
    name: '數與代數',
    nameEn: 'Number and Algebra',
    subtopics: [
      { id: 'math_na_1', name: '指數定律', nameEn: 'Laws of Indices' },
      { id: 'math_na_2', name: '多項式', nameEn: 'Polynomials' },
      { id: 'math_na_3', name: '因式分解', nameEn: 'Factorization' },
      { id: 'math_na_4', name: '二次方程', nameEn: 'Quadratic Equations' },
      { id: 'math_na_5', name: '函數及其圖像', nameEn: 'Functions and Graphs' },
      { id: 'math_na_6', name: '指數函數與對數函數', nameEn: 'Exponential and Logarithmic Functions' },
      { id: 'math_na_7', name: '等差數列與等比數列', nameEn: 'Arithmetic and Geometric Sequences' },
      { id: 'math_na_8', name: '不等式', nameEn: 'Inequalities' },
      { id: 'math_na_9', name: '線性規劃', nameEn: 'Linear Programming' },
      { id: 'math_na_10', name: '變分', nameEn: 'Variations' }
    ]
  },
  geometry: {
    id: 'geometry',
    name: '度量、圖形與空間',
    nameEn: 'Measures, Shape and Space',
    subtopics: [
      { id: 'math_geo_1', name: '直線方程', nameEn: 'Equations of Straight Lines' },
      { id: 'math_geo_2', name: '圓的方程', nameEn: 'Equations of Circles' },
      { id: 'math_geo_3', name: '軌跡', nameEn: 'Locus' },
      { id: 'math_geo_4', name: '演繹幾何', nameEn: 'Deductive Geometry' },
      { id: 'math_geo_5', name: '平面圖形的面積與周界', nameEn: 'Mensuration of Plane Figures' },
      { id: 'math_geo_6', name: '立體圖形', nameEn: 'Solid Figures' },
      { id: 'math_geo_7', name: '三維圖形的體積與表面積', nameEn: 'Volume and Surface Area of 3D Figures' },
      { id: 'math_geo_8', name: '相似與全等', nameEn: 'Similar and Congruent Triangles' }
    ]
  },
  trigonometry: {
    id: 'trigonometry',
    name: '三角學',
    nameEn: 'Trigonometry',
    subtopics: [
      { id: 'math_trig_1', name: '三角比', nameEn: 'Trigonometric Ratios' },
      { id: 'math_trig_2', name: '三角函數的圖像', nameEn: 'Graphs of Trigonometric Functions' },
      { id: 'math_trig_3', name: '三角恆等式', nameEn: 'Trigonometric Identities' },
      { id: 'math_trig_4', name: '解三角形', nameEn: 'Solving Triangles' },
      { id: 'math_trig_5', name: '弧度制與扇形', nameEn: 'Radian Measure and Sectors' },
      { id: 'math_trig_6', name: '二維與三維問題', nameEn: '2D and 3D Problems' }
    ]
  },
  statistics: {
    id: 'statistics',
    name: '數據處理',
    nameEn: 'Data Handling',
    subtopics: [
      { id: 'math_stat_1', name: '統計的表達方式', nameEn: 'Presentation of Data' },
      { id: 'math_stat_2', name: '集中趨勢的量度', nameEn: 'Measures of Central Tendency' },
      { id: 'math_stat_3', name: '離差的量度', nameEn: 'Measures of Dispersion' },
      { id: 'math_stat_4', name: '概率', nameEn: 'Probability' },
      { id: 'math_stat_5', name: '排列與組合', nameEn: 'Permutations and Combinations' }
    ]
  },
  calculus_m1: {
    id: 'calculus_m1',
    name: 'M1 微積分與統計',
    nameEn: 'M1 Calculus and Statistics',
    subtopics: [
      { id: 'math_m1_1', name: '二項式展開', nameEn: 'Binomial Expansion' },
      { id: 'math_m1_2', name: '極限與微分', nameEn: 'Limits and Differentiation' },
      { id: 'math_m1_3', name: '微分的應用', nameEn: 'Applications of Differentiation' },
      { id: 'math_m1_4', name: '積分', nameEn: 'Integration' },
      { id: 'math_m1_5', name: '定積分的應用', nameEn: 'Applications of Definite Integrals' },
      { id: 'math_m1_6', name: '離散隨機變量', nameEn: 'Discrete Random Variables' },
      { id: 'math_m1_7', name: '二項分佈', nameEn: 'Binomial Distribution' },
      { id: 'math_m1_8', name: '正態分佈', nameEn: 'Normal Distribution' },
      { id: 'math_m1_9', name: '抽樣分佈與估計', nameEn: 'Sampling Distribution and Estimation' }
    ]
  },
  algebra_m2: {
    id: 'algebra_m2',
    name: 'M2 代數與微積分',
    nameEn: 'M2 Algebra and Calculus',
    subtopics: [
      { id: 'math_m2_1', name: '數學歸納法', nameEn: 'Mathematical Induction' },
      { id: 'math_m2_2', name: '二項式定理', nameEn: 'Binomial Theorem' },
      { id: 'math_m2_3', name: '三角學進階', nameEn: 'More about Trigonometry' },
      { id: 'math_m2_4', name: 'e 和自然對數', nameEn: 'The Number e and Natural Logarithm' },
      { id: 'math_m2_5', name: '極限', nameEn: 'Limits' },
      { id: 'math_m2_6', name: '微分法', nameEn: 'Differentiation' },
      { id: 'math_m2_7', name: '微分的應用', nameEn: 'Applications of Differentiation' },
      { id: 'math_m2_8', name: '不定積分', nameEn: 'Indefinite Integration' },
      { id: 'math_m2_9', name: '定積分', nameEn: 'Definite Integration' },
      { id: 'math_m2_10', name: '定積分的應用', nameEn: 'Applications of Definite Integrals' },
      { id: 'math_m2_11', name: '矩陣', nameEn: 'Matrices' },
      { id: 'math_m2_12', name: '線性方程組', nameEn: 'Systems of Linear Equations' },
      { id: 'math_m2_13', name: '向量', nameEn: 'Vectors' }
    ]
  }
};

// Get all subtopics as a flat array
function getAllSubtopics() {
  const subtopics = [];
  for (const [categoryId, category] of Object.entries(MATH_TOPICS)) {
    for (const subtopic of category.subtopics) {
      subtopics.push({
        categoryId,
        categoryName: category.name,
        categoryNameEn: category.nameEn,
        ...subtopic
      });
    }
  }
  return subtopics;
}

// Generate a question using GPT-5-mini
async function generateQuestion(subtopic, language = 'zh') {
  const topicName = language === 'en' ? subtopic.nameEn : subtopic.name;
  const categoryName = language === 'en' ? subtopic.categoryNameEn : subtopic.categoryName;
  
  const prompt = `Generate ONE HKDSE Mathematics multiple choice question about "${topicName}" (${categoryName}).

Requirements:
1. Question must be in ${language === 'en' ? 'English' : 'Traditional Chinese (繁體中文)'}
2. Provide 4 options (A, B, C, D)
3. Include the correct answer and explanation
4. Use LaTeX format for math: $...$ for inline, $$...$$ for block
5. Difficulty: Level 3 (moderate DSE level)
6. If this topic involves coordinate geometry or graphs, include graphData for visualization

Output ONLY valid JSON in this exact format:
{
  "question": "Question text here...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correctAnswer": "A",
  "explanation": "Step-by-step solution...",
  "topic": "${subtopic.id}",
  "score": 1,
  "graphData": null
}

If graphData is needed for visualization, use this format:
{
  "graphData": {
    "type": "coordinate",
    "boundingBox": [-10, 10, 10, -10],
    "elements": [
      { "type": "point", "coords": [x, y], "label": "A" },
      { "type": "line", "points": [[x1,y1], [x2,y2]] },
      { "type": "circle", "center": [x, y], "radius": r },
      { "type": "curve", "equation": "x^2", "domain": [-5, 5] }
    ],
    "showGrid": true,
    "showAxis": true
  }
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'You are an expert HKDSE Mathematics examiner. Generate high-quality exam questions. Output ONLY valid JSON.' },
          { role: 'user', content: prompt }
        ],
        // Note: GPT-5 series doesn't support temperature parameter
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const question = JSON.parse(jsonMatch[0]);
    question.usage = data.usage;
    
    return { success: true, question };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const subtopics = getAllSubtopics();
  console.log(`\n🚀 Generating questions for ${subtopics.length} Math subtopics\n`);
  console.log('=' .repeat(60));

  const results = {
    success: [],
    failed: [],
    questions: []
  };

  const DELAY_MS = 2000; // 2 second delay between requests

  for (let i = 0; i < subtopics.length; i++) {
    const subtopic = subtopics[i];
    const progress = `[${i + 1}/${subtopics.length}]`;
    
    console.log(`${progress} ${subtopic.name} (${subtopic.nameEn})...`);
    
    const result = await generateQuestion(subtopic, 'zh');
    
    if (result.success) {
      console.log(`  ✅ Generated (${result.question.usage?.total_tokens || '?'} tokens)`);
      results.success.push(subtopic.id);
      results.questions.push({
        subtopicId: subtopic.id,
        subtopicName: subtopic.name,
        categoryName: subtopic.categoryName,
        question: result.question
      });
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
      results.failed.push({ id: subtopic.id, error: result.error });
    }

    // Delay between requests
    if (i < subtopics.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Success: ${results.success.length}`);
  console.log(`  ❌ Failed: ${results.failed.length}`);

  // Save results to file
  const outputPath = './math-questions-generated.json';
  const fs = require('fs');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to ${outputPath}`);

  // Print sample questions
  if (results.questions.length > 0) {
    console.log('\n📝 Sample Questions:');
    console.log('-'.repeat(60));
    for (let i = 0; i < Math.min(3, results.questions.length); i++) {
      const q = results.questions[i];
      console.log(`\n${i + 1}. [${q.subtopicName}]`);
      console.log(`   Q: ${q.question.question?.substring(0, 100)}...`);
      console.log(`   A: ${q.question.correctAnswer}`);
    }
  }
}

main().catch(console.error);

