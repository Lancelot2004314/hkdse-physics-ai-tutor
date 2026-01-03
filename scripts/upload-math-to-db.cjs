/**
 * Upload generated math questions to D1 database
 * Run: node scripts/upload-math-to-db.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const INPUT_FILE = path.join(__dirname, '..', 'math-questions-generated.json');

async function main() {
    console.log('📖 Reading math questions from:', INPUT_FILE);

    const raw = fs.readFileSync(INPUT_FILE, 'utf8');
    const data = JSON.parse(raw);

    const questions = data.questions || [];
    console.log(`✅ Found ${questions.length} questions to upload\n`);

    if (questions.length === 0) {
        console.log('No questions to upload');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const q of questions) {
        const topicKey = q.subtopicId || q.topic || '';
        const questionData = q.question || q;

        // Prepare question JSON
        const questionJson = JSON.stringify(questionData).replace(/'/g, "''");

        const id = `qb_math_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        // Build SQL INSERT statement
        const sql = `INSERT INTO question_bank (id, subject, topic_key, language, qtype, difficulty, question_json, status, kb_backend, rewrite_mode, llm_model) VALUES ('${id}', 'Mathematics', '${topicKey}', 'zh', 'mc', 3, '${questionJson}', 'ready', 'none', 0, 'gpt-5-mini');`;

        // Write SQL to temp file and execute
        const tempFile = path.join(__dirname, 'temp-insert.sql');
        fs.writeFileSync(tempFile, sql);

        try {
            execSync(`npx wrangler d1 execute hkdse-physics-tutor-db --remote --file="${tempFile}"`, {
                cwd: path.join(__dirname, '..'),
                stdio: 'pipe'
            });
            console.log(`✅ Uploaded: ${topicKey} (${q.subtopicName || ''})`);
            successCount++;
        } catch (err) {
            console.error(`❌ Failed: ${topicKey} - ${err.message.slice(0, 100)}`);
            failCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    // Cleanup
    try {
        fs.unlinkSync(path.join(__dirname, 'temp-insert.sql'));
    } catch { }

    console.log(`\n📊 Upload complete: ${successCount} success, ${failCount} failed`);
}

main().catch(console.error);

