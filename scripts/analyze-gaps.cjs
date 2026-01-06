/**
 * Gap Analysis Script for Duolingo-style Learning System
 * 
 * Analyzes the question bank to identify gaps in coverage:
 * - Questions needed per (skill_node, difficulty, qtype) combination
 * - Generates a report showing where new questions are needed
 * - Outputs actionable data for question generation
 * 
 * Run: node scripts/analyze-gaps.cjs
 * 
 * Target: At least 10 questions per (skill_node, difficulty, qtype) combination
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Target count per combination
const TARGET_COUNT = 10;

// All skill nodes from skillTreeConfig.js
const SKILL_NODES = [
  // Unit 1: Heat and Gases
  { id: 'heat-1a', name: 'Temperature, Heat and Internal Energy', unit: 'Heat and Gases' },
  { id: 'heat-1b', name: 'Transfer Processes', unit: 'Heat and Gases' },
  { id: 'heat-1c', name: 'Change of State', unit: 'Heat and Gases' },
  { id: 'heat-1d', name: 'Gases', unit: 'Heat and Gases' },
  // Unit 2: Force and Motion
  { id: 'motion-2a', name: 'Position and Movement', unit: 'Force and Motion' },
  { id: 'motion-2b', name: 'Force and Motion', unit: 'Force and Motion' },
  { id: 'motion-2c', name: 'Projectile Motion', unit: 'Force and Motion' },
  { id: 'motion-2d', name: 'Work, Energy and Power', unit: 'Force and Motion' },
  { id: 'motion-2e', name: 'Momentum', unit: 'Force and Motion' },
  { id: 'motion-2f', name: 'Uniform Circular Motion', unit: 'Force and Motion' },
  { id: 'motion-2g', name: 'Gravitation', unit: 'Force and Motion' },
  // Unit 3: Wave Motion
  { id: 'wave-3a', name: 'Nature and Properties of Waves', unit: 'Wave Motion' },
  { id: 'wave-3b', name: 'Light', unit: 'Wave Motion' },
  { id: 'wave-3c', name: 'Sound', unit: 'Wave Motion' },
  // Unit 4: Electricity and Magnetism
  { id: 'em-4a', name: 'Electrostatics', unit: 'Electricity and Magnetism' },
  { id: 'em-4b', name: 'Circuits and Domestic Electricity', unit: 'Electricity and Magnetism' },
  { id: 'em-4c', name: 'Electromagnetism', unit: 'Electricity and Magnetism' },
  // Unit 5: Radioactivity and Nuclear Energy
  { id: 'nuclear-5a', name: 'Radiation and Radioactivity', unit: 'Radioactivity' },
  { id: 'nuclear-5b', name: 'Atomic Model', unit: 'Radioactivity' },
  { id: 'nuclear-5c', name: 'Nuclear Energy', unit: 'Radioactivity' },
  // Electives
  { id: 'elective-astro', name: 'Astronomy and Space Science', unit: 'Elective' },
  { id: 'elective-atomic', name: 'Atomic World', unit: 'Elective' },
];

const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5];
const QUESTION_TYPES = ['mc', 'short', 'long'];
const LEARN_QTYPES = ['fill-in', 'matching', 'ordering']; // New Duolingo-style types

async function fetchQuestionCounts() {
  console.log('📥 Fetching question counts from database...\n');
  
  try {
    // Query to get counts by skill_node_id, calibrated_difficulty, and qtype
    const query = `
      SELECT 
        skill_node_id,
        calibrated_difficulty,
        qtype,
        learn_qtype,
        COUNT(*) as count
      FROM question_bank 
      WHERE status = 'ready' 
        AND skill_node_id IS NOT NULL
      GROUP BY skill_node_id, calibrated_difficulty, qtype, learn_qtype
      ORDER BY skill_node_id, calibrated_difficulty, qtype;
    `;
    
    const result = execSync(
      `npx wrangler d1 execute hkdse-physics-tutor-db --remote --json --command="${query.replace(/\n/g, ' ')}"`,
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    const parsed = JSON.parse(result);
    const rows = parsed[0]?.results || [];
    
    console.log(`📊 Found ${rows.length} skill/difficulty/type combinations with questions\n`);
    return rows;
  } catch (err) {
    console.error('Failed to query database:', err.message);
    return [];
  }
}

async function fetchTotalStats() {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN calibrated_difficulty IS NOT NULL THEN 1 END) as calibrated,
        COUNT(CASE WHEN skill_node_id IS NOT NULL THEN 1 END) as mapped
      FROM question_bank WHERE status = 'ready';
    `;
    
    const result = execSync(
      `npx wrangler d1 execute hkdse-physics-tutor-db --remote --json --command="${query.replace(/\n/g, ' ')}"`,
      { cwd: path.join(__dirname, '..'), encoding: 'utf8' }
    );
    
    const parsed = JSON.parse(result);
    return parsed[0]?.results[0] || { total: 0, calibrated: 0, mapped: 0 };
  } catch (err) {
    return { total: 0, calibrated: 0, mapped: 0 };
  }
}

function buildCountMap(rows) {
  const countMap = {};
  
  for (const row of rows) {
    const skillNode = row.skill_node_id;
    const difficulty = row.calibrated_difficulty || row.difficulty || 3;
    const qtype = row.learn_qtype || row.qtype || 'mc';
    
    const key = `${skillNode}|${difficulty}|${qtype}`;
    countMap[key] = (countMap[key] || 0) + row.count;
  }
  
  return countMap;
}

function analyzeGaps(countMap) {
  const gaps = [];
  const summary = {
    totalCombinations: 0,
    coveredCombinations: 0,
    gapsFound: 0,
    questionsNeeded: 0,
    byUnit: {},
    byDifficulty: {},
    byQtype: {},
  };
  
  // Check each combination
  for (const node of SKILL_NODES) {
    for (const difficulty of DIFFICULTY_LEVELS) {
      // Check traditional question types
      for (const qtype of QUESTION_TYPES) {
        summary.totalCombinations++;
        
        const key = `${node.id}|${difficulty}|${qtype}`;
        const count = countMap[key] || 0;
        
        if (count > 0) summary.coveredCombinations++;
        
        if (count < TARGET_COUNT) {
          const needed = TARGET_COUNT - count;
          summary.gapsFound++;
          summary.questionsNeeded += needed;
          
          // Track by unit
          summary.byUnit[node.unit] = (summary.byUnit[node.unit] || 0) + needed;
          // Track by difficulty
          summary.byDifficulty[difficulty] = (summary.byDifficulty[difficulty] || 0) + needed;
          // Track by qtype
          summary.byQtype[qtype] = (summary.byQtype[qtype] || 0) + needed;
          
          gaps.push({
            skillNodeId: node.id,
            skillNodeName: node.name,
            unit: node.unit,
            difficulty,
            qtype,
            current: count,
            needed,
            priority: difficulty === 3 ? 'high' : difficulty === 2 || difficulty === 4 ? 'medium' : 'low',
          });
        }
      }
      
      // Check Duolingo-style question types
      for (const learnQtype of LEARN_QTYPES) {
        summary.totalCombinations++;
        
        const key = `${node.id}|${difficulty}|${learnQtype}`;
        const count = countMap[key] || 0;
        
        if (count > 0) summary.coveredCombinations++;
        
        if (count < TARGET_COUNT) {
          const needed = TARGET_COUNT - count;
          summary.gapsFound++;
          summary.questionsNeeded += needed;
          
          summary.byUnit[node.unit] = (summary.byUnit[node.unit] || 0) + needed;
          summary.byDifficulty[difficulty] = (summary.byDifficulty[difficulty] || 0) + needed;
          summary.byQtype[learnQtype] = (summary.byQtype[learnQtype] || 0) + needed;
          
          gaps.push({
            skillNodeId: node.id,
            skillNodeName: node.name,
            unit: node.unit,
            difficulty,
            qtype: learnQtype,
            isLearnType: true,
            current: count,
            needed,
            priority: 'high', // New types are high priority
          });
        }
      }
    }
  }
  
  return { gaps, summary };
}

function printReport(stats, analysis) {
  const { gaps, summary } = analysis;
  
  console.log('═'.repeat(70));
  console.log('  📊 DSE Physics Question Bank Gap Analysis Report');
  console.log('═'.repeat(70));
  
  console.log('\n📈 OVERALL STATS');
  console.log('─'.repeat(40));
  console.log(`  Total Questions:      ${stats.total}`);
  console.log(`  Calibrated:           ${stats.calibrated} (${((stats.calibrated / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Mapped to Skills:     ${stats.mapped} (${((stats.mapped / stats.total) * 100).toFixed(1)}%)`);
  
  console.log('\n📉 GAP SUMMARY');
  console.log('─'.repeat(40));
  console.log(`  Total Combinations:   ${summary.totalCombinations}`);
  console.log(`  Covered:              ${summary.coveredCombinations} (${((summary.coveredCombinations / summary.totalCombinations) * 100).toFixed(1)}%)`);
  console.log(`  Gaps Found:           ${summary.gapsFound}`);
  console.log(`  Questions Needed:     ${summary.questionsNeeded}`);
  
  console.log('\n📚 BY UNIT');
  console.log('─'.repeat(40));
  for (const [unit, needed] of Object.entries(summary.byUnit).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.min(30, Math.ceil(needed / 50)));
    console.log(`  ${unit.padEnd(25)} ${String(needed).padStart(4)} ${bar}`);
  }
  
  console.log('\n🎯 BY DIFFICULTY');
  console.log('─'.repeat(40));
  for (const [diff, needed] of Object.entries(summary.byDifficulty).sort((a, b) => a[0] - b[0])) {
    const diffLabel = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'][diff];
    const bar = '█'.repeat(Math.min(30, Math.ceil(needed / 50)));
    console.log(`  D${diff} ${diffLabel.padEnd(12)} ${String(needed).padStart(4)} ${bar}`);
  }
  
  console.log('\n📝 BY QUESTION TYPE');
  console.log('─'.repeat(40));
  for (const [qtype, needed] of Object.entries(summary.byQtype).sort((a, b) => b[1] - a[1])) {
    const typeLabel = {
      'mc': 'Multiple Choice',
      'short': 'Short Answer',
      'long': 'Long Answer',
      'fill-in': 'Fill in Blank ★',
      'matching': 'Matching ★',
      'ordering': 'Ordering ★',
    }[qtype] || qtype;
    const bar = '█'.repeat(Math.min(30, Math.ceil(needed / 50)));
    console.log(`  ${typeLabel.padEnd(20)} ${String(needed).padStart(4)} ${bar}`);
  }
  
  // Show top priority gaps
  console.log('\n🔥 TOP PRIORITY GAPS (First 20)');
  console.log('─'.repeat(70));
  console.log('  Skill Node              | Diff | Type       | Have | Need | Priority');
  console.log('─'.repeat(70));
  
  const priorityGaps = gaps
    .filter(g => g.priority === 'high')
    .sort((a, b) => b.needed - a.needed)
    .slice(0, 20);
  
  for (const gap of priorityGaps) {
    const name = gap.skillNodeName.substring(0, 22).padEnd(22);
    const diff = `D${gap.difficulty}`.padEnd(4);
    const type = gap.qtype.padEnd(10);
    const have = String(gap.current).padStart(4);
    const need = String(gap.needed).padStart(4);
    const star = gap.isLearnType ? '★' : ' ';
    console.log(`  ${name} | ${diff} | ${type} | ${have} | ${need} | ${gap.priority} ${star}`);
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('  ★ = New Duolingo-style question type (fill-in, matching, ordering)');
  console.log('═'.repeat(70));
  
  return gaps;
}

function saveGapsToFile(gaps) {
  const outputPath = path.join(__dirname, 'gap-analysis-results.json');
  
  const output = {
    generatedAt: new Date().toISOString(),
    targetPerCombination: TARGET_COUNT,
    gaps: gaps,
    actionable: gaps.filter(g => g.priority === 'high').map(g => ({
      skillNodeId: g.skillNodeId,
      difficulty: g.difficulty,
      qtype: g.qtype,
      count: g.needed,
    })),
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n📄 Full results saved to: ${outputPath}`);
  
  return outputPath;
}

async function main() {
  console.log('\n🔍 DSE Physics Question Bank Gap Analysis\n');
  console.log(`Target: ${TARGET_COUNT} questions per (skill_node, difficulty, qtype) combination\n`);
  
  // Fetch data
  const [countRows, stats] = await Promise.all([
    fetchQuestionCounts(),
    fetchTotalStats(),
  ]);
  
  // Build count map
  const countMap = buildCountMap(countRows);
  
  // Analyze gaps
  const analysis = analyzeGaps(countMap);
  
  // Print report
  const gaps = printReport(stats, analysis);
  
  // Save to file
  saveGapsToFile(gaps);
  
  console.log('\n✅ Analysis complete!');
  console.log('   Next step: Run generate-learn-questions.cjs to fill gaps');
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});


