/**
 * Answer Question API
 * POST /api/learn/lesson/answer
 * 
 * Submits an answer for a question during a lesson
 * Returns immediate feedback and updates hearts/XP
 * 
 * Uses DeepSeek deepseek-chat for short/long answer grading
 */

import { parseSessionCookie, hashToken } from '../../../../shared/auth.js';

// DeepSeek configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const GRADING_MODEL = 'deepseek-chat';

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

// Get question from database
async function getQuestion(db, questionId) {
  const result = await db.prepare(
    'SELECT id, question_json, qtype, learn_qtype, language FROM question_bank WHERE id = ?'
  ).bind(questionId).first();

  if (!result) return null;

  try {
    const parsed = typeof result.question_json === 'string'
      ? JSON.parse(result.question_json)
      : result.question_json;
    return {
      ...result,
      parsed,
      type: result.learn_qtype || result.qtype,
    };
  } catch {
    return null;
  }
}

// Check MC answer
function checkMCAnswer(question, userAnswer) {
  const correctAnswer = question.parsed.correctAnswer;
  const isCorrect = userAnswer.toUpperCase() === correctAnswer.toUpperCase();

  return {
    isCorrect,
    correctAnswer,
    explanation: question.parsed.explanation,
  };
}

// Check fill-in-the-blank answer
function checkFillInAnswer(question, userAnswers) {
  const correctBlanks = question.parsed.blanks || [];
  // Support alternative correct answers per blank
  const alternativeAnswers = question.parsed.alternativeAnswers || [];
  const userBlanksArray = Array.isArray(userAnswers) ? userAnswers : [userAnswers];

  let correctCount = 0;
  const results = correctBlanks.map((correct, i) => {
    const userAns = normalizeAnswer((userBlanksArray[i] || ''));
    const correctAns = normalizeAnswer(correct);

    // Get alternative answers for this blank
    const alternatives = (alternativeAnswers[i] || []).map(normalizeAnswer);

    // Check for exact match or acceptable alternatives
    const isMatch = userAns === correctAns || alternatives.includes(userAns);

    // For numeric answers, allow small variations
    const numericMatch = isNumericMatch(userAns, correctAns);

    if (isMatch || numericMatch) correctCount++;

    return {
      userAnswer: userBlanksArray[i],
      correctAnswer: correct,
      isCorrect: isMatch || numericMatch
    };
  });

  return {
    isCorrect: correctCount === correctBlanks.length,
    partialCorrect: correctCount > 0,
    correctCount,
    totalBlanks: correctBlanks.length,
    results,
    explanation: question.parsed.explanation,
  };
}

// Normalize answer for comparison (trim, lowercase, remove extra spaces)
function normalizeAnswer(answer) {
  return (answer || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[，。、；：]/g, '')  // Remove Chinese punctuation
    .replace(/[,.;:]/g, '');  // Remove English punctuation
}

// Check if two answers are numerically equivalent
function isNumericMatch(userAns, correctAns) {
  // Try to parse as numbers
  const userNum = parseFloat(userAns);
  const correctNum = parseFloat(correctAns);

  if (isNaN(userNum) || isNaN(correctNum)) {
    return false;
  }

  // Allow for small floating point differences (0.1% tolerance)
  const tolerance = Math.abs(correctNum) * 0.001 || 0.001;
  return Math.abs(userNum - correctNum) <= tolerance;
}

// Check matching answer
function checkMatchingAnswer(question, userPairs) {
  const correctPairs = question.parsed.correctPairs || [];

  let correctCount = 0;
  for (const [left, right] of correctPairs) {
    const userMatch = userPairs.find(p => p[0] === left);
    if (userMatch && userMatch[1] === right) {
      correctCount++;
    }
  }

  const isCorrect = correctCount === correctPairs.length;

  return {
    isCorrect,
    correctCount,
    totalPairs: correctPairs.length,
    correctPairs,
    explanation: question.parsed.explanation,
  };
}

// Check ordering answer
function checkOrderingAnswer(question, userOrder) {
  const correctOrder = question.parsed.correctOrder || [];

  // Check if user order matches correct order
  const isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder);

  // Count how many are in correct position
  let correctPositions = 0;
  for (let i = 0; i < correctOrder.length; i++) {
    if (userOrder[i] === correctOrder[i]) {
      correctPositions++;
    }
  }

  return {
    isCorrect,
    correctPositions,
    totalItems: correctOrder.length,
    correctOrder,
    explanation: question.parsed.explanation,
  };
}

// Grade short/long answer using DeepSeek AI
async function gradeTextAnswer(question, userAnswer, env) {
  // Try DeepSeek first, then fall back to OpenAI, then simple grading
  const deepseekKey = env.DEEPSEEK_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;

  // Check if user answer is too short to be valid
  const trimmedAnswer = (userAnswer || '').trim();
  if (trimmedAnswer.length < 3) {
    return {
      isCorrect: false,
      score: 0,
      feedback: '答案太短，請提供更詳細的回答。',
      noHeartPenalty: false,
    };
  }

  // If no API keys available, use simple grading
  if (!deepseekKey && !openaiKey) {
    return gradeTextAnswerSimple(question, trimmedAnswer);
  }

  const modelAnswer = question.parsed.modelAnswer ||
    question.parsed.parts?.map(p => p.modelAnswer).join('\n\n') || '';
  const markingScheme = question.parsed.markingScheme || [];

  // Build grading prompt - designed for DeepSeek deepseek-chat
  // Keep it concise and structured for better results
  const prompt = `你是DSE物理評分員。請評分以下答案。

題目：${question.parsed.question}

參考答案：${modelAnswer || '無'}

評分要點：${markingScheme.length > 0 ? markingScheme.join('、') : '物理概念準確性'}

學生答案：${userAnswer}

評分規則：
- 概念正確且完整：80-100分
- 基本正確有小錯：60-79分  
- 部分正確有遺漏：40-59分
- 概念錯誤或離題：0-39分

請用JSON回覆（只輸出JSON，不要其他文字）：
{"score":分數,"feedback":"評語","missed":["遺漏要點"]}`;

  try {
    // Use DeepSeek API (OpenAI compatible)
    const apiUrl = deepseekKey ? DEEPSEEK_API_URL : 'https://api.openai.com/v1/chat/completions';
    const apiKey = deepseekKey || openaiKey;
    const model = deepseekKey ? GRADING_MODEL : 'gpt-4o-mini';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();

    // Try to parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from the response (handle markdown code blocks too)
      const jsonStr = content.replace(/```json\s*|\s*```/g, '').trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.warn('Failed to parse AI response:', content);
    }

    if (parsed && typeof parsed.score === 'number') {
      // Validate and normalize the response
      const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
      const isCorrect = score >= 60;

      return {
        score,
        isCorrect,
        feedback: parsed.feedback || (isCorrect ? '答案正確！' : '答案需要改進。'),
        keyPointsMissed: Array.isArray(parsed.missed) ? parsed.missed : [],
        noHeartPenalty: false,
      };
    }

    // AI didn't return valid JSON, fall back to simple grading
    console.warn('AI grading returned invalid response, using simple grading');
    return gradeTextAnswerSimple(question, trimmedAnswer);
  } catch (err) {
    console.error('AI grading error:', err.message);
    // Fall back to simple grading on error
    return gradeTextAnswerSimple(question, trimmedAnswer);
  }
}

// Simple keyword-based grading when AI is unavailable
function gradeTextAnswerSimple(question, userAnswer) {
  const modelAnswer = (question.parsed.modelAnswer || '').toLowerCase();
  const keywords = question.parsed.keywords || [];
  const userLower = userAnswer.toLowerCase();

  // Extract keywords from model answer if not provided
  const keywordsToCheck = keywords.length > 0
    ? keywords
    : modelAnswer.split(/\s+/).filter(w => w.length > 3);

  // Count matching keywords
  let matches = 0;
  for (const keyword of keywordsToCheck) {
    if (userLower.includes(keyword.toLowerCase())) {
      matches++;
    }
  }

  const matchRatio = keywordsToCheck.length > 0 ? matches / keywordsToCheck.length : 0;
  const score = Math.round(matchRatio * 100);
  const isCorrect = score >= 50;

  return {
    isCorrect,
    score,
    feedback: isCorrect
      ? '答案包含了一些重要的概念。繼續努力！'
      : '答案可能遺漏了一些關鍵概念。請參考正確答案學習。',
    correctAnswer: question.parsed.modelAnswer || undefined,
    noHeartPenalty: !isCorrect, // Don't penalize for simple grading failures
  };
}

// Update user hearts
async function updateHearts(db, userId, heartsLost) {
  if (heartsLost > 0) {
    await db.prepare(`
      UPDATE user_hearts SET hearts = MAX(0, hearts - ?) WHERE user_id = ?
    `).bind(heartsLost, userId).run();
  }

  const result = await db.prepare(
    'SELECT hearts FROM user_hearts WHERE user_id = ?'
  ).bind(userId).first();

  return result?.hearts ?? 0;
}

// Update lesson session progress
async function updateLessonProgress(db, sessionId, isCorrect, xpEarned) {
  await db.prepare(`
    UPDATE lesson_sessions 
    SET questions_answered = questions_answered + 1,
        questions_correct = questions_correct + ?,
        hearts_lost = hearts_lost + ?,
        xp_earned = xp_earned + ?
    WHERE id = ?
  `).bind(
    isCorrect ? 1 : 0,
    isCorrect ? 0 : 1,
    xpEarned,
    sessionId,
  ).run();
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, questionId, answer } = body;

    if (!sessionId || !questionId || answer === undefined) {
      return Response.json({
        error: 'sessionId, questionId, and answer are required'
      }, { status: 400 });
    }

    // Verify session belongs to user
    const session = await env.DB.prepare(
      'SELECT * FROM lesson_sessions WHERE id = ? AND user_id = ? AND status = ?'
    ).bind(sessionId, user.id, 'in_progress').first();

    if (!session) {
      return Response.json({ error: 'Invalid or expired session' }, { status: 400 });
    }

    // Get question
    const question = await getQuestion(env.DB, questionId);
    if (!question) {
      return Response.json({ error: 'Question not found' }, { status: 404 });
    }

    // Check answer based on question type
    let result;

    switch (question.type) {
      case 'mc':
        result = checkMCAnswer(question, answer);
        break;

      case 'fill-in':
        result = checkFillInAnswer(question, answer);
        break;

      case 'matching':
        result = checkMatchingAnswer(question, answer);
        break;

      case 'ordering':
        result = checkOrderingAnswer(question, answer);
        break;

      case 'short':
      case 'long':
        result = await gradeTextAnswer(question, answer, env);
        break;

      default:
        result = { isCorrect: false, feedback: 'Unknown question type' };
    }

    // Check if this is heart practice mode
    const isHeartPractice = session.lesson_type === 'heart_practice';

    // Calculate XP (0 for heart practice)
    let xpEarned = 0;
    if (result.isCorrect && !isHeartPractice) {
      xpEarned = 10; // Base XP for correct answer

      // Streak bonus could be added here
    }

    // Update hearts if wrong (but NOT during heart practice or if noHeartPenalty flag is set)
    let currentHearts = null;
    if (!result.isCorrect && !isHeartPractice && !result.noHeartPenalty) {
      currentHearts = await updateHearts(env.DB, user.id, 1);
    }

    // Update lesson progress
    await updateLessonProgress(env.DB, sessionId, result.isCorrect, xpEarned);

    // Get updated session
    const updatedSession = await env.DB.prepare(
      'SELECT questions_answered, questions_correct, questions_total, xp_earned, hearts_lost FROM lesson_sessions WHERE id = ?'
    ).bind(sessionId).first();

    return Response.json({
      success: true,
      isCorrect: result.isCorrect,
      isHeartPractice,
      xpEarned,
      ...result,
      progress: {
        answered: updatedSession.questions_answered,
        correct: updatedSession.questions_correct,
        total: updatedSession.questions_total,
        xpEarned: updatedSession.xp_earned,
        heartsLost: updatedSession.hearts_lost,
      },
      hearts: currentHearts !== null ? currentHearts : undefined,
    });

  } catch (err) {
    console.error('Answer error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

