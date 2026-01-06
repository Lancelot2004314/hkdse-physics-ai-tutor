/**
 * Start Lesson API
 * POST /api/learn/lesson/start
 * 
 * Starts a new lesson for a skill node, returns questions to answer
 */

import { SKILL_TREE_NODES, XP_CONFIG } from '../../../../shared/skillTreeConfig.js';
import { parseSessionCookie, hashToken } from '../../../../shared/auth.js';

const QUESTIONS_PER_LESSON = 5;

// Helper to get user from session
async function getUser(request, env) {
    const cookieHeader = request.headers.get('Cookie');
    const sessionToken = parseSessionCookie(cookieHeader);
    if (!sessionToken) return null;

    const tokenHash = await hashToken(sessionToken);
    const session = await env.DB.prepare(
        'SELECT user_id FROM sessions WHERE token_hash = ?'
    ).bind(tokenHash).first();

    if (!session) return null;

    return await env.DB.prepare(
        'SELECT id, email, name as display_name FROM users WHERE id = ?'
    ).bind(session.user_id).first();
}

// Get user hearts
async function getUserHearts(db, userId) {
    const hearts = await db.prepare(
        'SELECT hearts FROM user_hearts WHERE user_id = ?'
    ).bind(userId).first();

    return hearts?.hearts ?? 5;
}

// Get questions for a skill node
async function getQuestionsForLesson(db, skillNodeId, difficulty, lessonType, userLevel = 0) {
    // #region agent log
    console.log('[DEBUG] getQuestionsForLesson:', { skillNodeId, difficulty, lessonType, userLevel });
    // #endregion

    // For beginners (level 0-1), prioritize easier questions but accept any
    // For higher levels, prefer matching difficulty
    const isBeginnerOrLowLevel = userLevel <= 1;

    // Get ALL questions for this skill (we'll sort by difficulty preference later)
    let results = await db.prepare(`
    SELECT id, question_json, language, qtype, learn_qtype, calibrated_difficulty as difficulty
    FROM question_bank 
    WHERE skill_node_id = ? 
      AND status = 'ready'
    ORDER BY 
      CASE WHEN calibrated_difficulty IS NULL THEN 999 
           WHEN ? = 1 THEN calibrated_difficulty 
           ELSE ABS(calibrated_difficulty - ?) 
      END,
      RANDOM()
    LIMIT ?
  `).bind(skillNodeId, isBeginnerOrLowLevel ? 1 : 0, difficulty, QUESTIONS_PER_LESSON * 2).all();

    // #region agent log
    console.log('[DEBUG] Query results count:', results.results?.length || 0);
    // #endregion

    let questions = results.results || [];

    // If not enough questions, also search by topic_key
    if (questions.length < QUESTIONS_PER_LESSON) {
        const moreResults = await db.prepare(`
      SELECT id, question_json, language, qtype, learn_qtype, difficulty
      FROM question_bank 
      WHERE topic_key LIKE ?
        AND status = 'ready'
        AND id NOT IN (${questions.map(q => `'${q.id}'`).join(',') || "''"})
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(`${skillNodeId}%`, QUESTIONS_PER_LESSON - questions.length).all();

        questions = [...questions, ...(moreResults.results || [])];
    }

    // Shuffle and take required number
    questions = questions.sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_LESSON);

    // Parse question JSON and format for frontend
    return questions.map((q, index) => {
        let parsed;
        try {
            parsed = typeof q.question_json === 'string' ? JSON.parse(q.question_json) : q.question_json;
        } catch {
            parsed = { question: 'Error loading question' };
        }

        const rawType = q.learn_qtype || q.qtype || 'mc';

        // Map database qtypes to frontend types
        const typeMap = {
            'mc': 'mc',
            'fill_blank': 'fill-in',
            'fill-in': 'fill-in',
            'short': 'short-answer',
            'matching': 'matching',
            'ordering': 'ordering',
        };
        const questionType = typeMap[rawType] || 'mc';

        return {
            id: q.id,
            index: index + 1,
            type: questionType,
            language: q.language,
            difficulty: q.difficulty || 3,
            ...formatQuestionForFrontend(parsed, questionType),
        };
    });
}

// Format question data for frontend display
function formatQuestionForFrontend(parsed, type) {
    // Handle different question JSON structures
    const question = parsed.question || parsed.stem || parsed.text || '';

    // For MC questions, options might be in different formats
    let options = parsed.options;
    if (!options && parsed.choices) {
        options = parsed.choices;
    }
    if (!options && parsed.A) {
        // Format: { A: "...", B: "...", C: "...", D: "..." }
        options = ['A', 'B', 'C', 'D'].map(k => parsed[k]).filter(Boolean);
    }

    switch (type) {
        case 'mc':
            return {
                question: question,
                options: options || ['Option A', 'Option B', 'Option C', 'Option D'],
                // Don't send correct answer to frontend!
            };

        case 'fill-in':
            return {
                question: question,
                blanks: parsed.blanks?.length || 1,
                hints: parsed.hints,
            };

        case 'matching':
            return {
                question: question,
                leftItems: parsed.leftItems || [],
                rightItems: shuffleArray([...(parsed.rightItems || [])]),
                // Don't send correct pairs!
            };

        case 'ordering':
            return {
                question: question,
                items: shuffleArray([...(parsed.items || [])]),
                // Don't send correct order!
            };

        case 'short-answer':
            // Simple short answer (from generated questions)
            return {
                question: question,
                placeholder: '請輸入你的答案...',
            };

        case 'short':
        case 'long':
            return {
                question: question,
                parts: parsed.parts?.map(p => ({
                    part: p.part,
                    question: p.question,
                    marks: p.marks,
                })),
                totalMarks: parsed.totalMarks,
            };

        default:
            return { question: question };
    }
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateSessionId() {
    return 'les_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export async function onRequestPost({ request, env }) {
    try {
        const user = await getUser(request, env);
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { skillNodeId, lessonType = 'practice' } = body;

        if (!skillNodeId) {
            return Response.json({ error: 'skillNodeId is required' }, { status: 400 });
        }

        const node = SKILL_TREE_NODES.find(n => n.id === skillNodeId);
        if (!node) {
            return Response.json({ error: 'Invalid skill node' }, { status: 400 });
        }

        // Check hearts
        const hearts = await getUserHearts(env.DB, user.id);
        if (hearts <= 0) {
            return Response.json({
                error: 'No hearts remaining',
                hearts: 0,
                nextRefillAt: Date.now() + 4 * 60 * 60 * 1000,
            }, { status: 400 });
        }

        // Get user's current level for this skill
        const progress = await env.DB.prepare(
            'SELECT current_level FROM user_skill_progress WHERE user_id = ? AND skill_node_id = ?'
        ).bind(user.id, skillNodeId).first();

        const currentLevel = progress?.current_level || 0;
        // For beginners (level 0-1), use wider difficulty range
        const targetDifficulty = Math.min(5, Math.max(1, currentLevel + 1));

        // Get questions - pass level to adjust difficulty tolerance
        const questions = await getQuestionsForLesson(env.DB, skillNodeId, targetDifficulty, lessonType, currentLevel);

        if (questions.length === 0) {
            // #region agent log - Debug query
            const debugCount = await env.DB.prepare(
                'SELECT COUNT(*) as cnt FROM question_bank WHERE skill_node_id = ? AND status = ?'
            ).bind(skillNodeId, 'ready').first();
            const allSkillNodes = await env.DB.prepare(
                'SELECT DISTINCT skill_node_id FROM question_bank WHERE skill_node_id IS NOT NULL LIMIT 10'
            ).all();
            // #endregion

            return Response.json({
                error: 'No questions available for this skill',
                skillNodeId,
                debug: {
                    requestedSkillNode: skillNodeId,
                    matchingQuestionsCount: debugCount?.cnt || 0,
                    availableSkillNodes: allSkillNodes.results?.map(r => r.skill_node_id) || [],
                }
            }, { status: 404 });
        }

        // Create lesson session
        const sessionId = generateSessionId();
        await env.DB.prepare(`
      INSERT INTO lesson_sessions (id, user_id, skill_node_id, lesson_type, difficulty, questions_total, question_ids, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress')
    `).bind(
            sessionId,
            user.id,
            skillNodeId,
            lessonType,
            targetDifficulty,
            questions.length,
            JSON.stringify(questions.map(q => q.id)),
        ).run();

        return Response.json({
            success: true,
            sessionId,
            skillNode: {
                id: node.id,
                name: node.name,
                name_zh: node.name_zh,
            },
            lessonType,
            difficulty: targetDifficulty,
            totalQuestions: questions.length,
            hearts,
            questions,
            xpConfig: {
                correctAnswer: XP_CONFIG.correctAnswer,
                correctAnswerBonus: XP_CONFIG.correctAnswerBonus,
                lessonComplete: XP_CONFIG.lessonComplete,
                perfectLesson: XP_CONFIG.perfectLesson,
            },
        });

    } catch (err) {
        console.error('Start lesson error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

