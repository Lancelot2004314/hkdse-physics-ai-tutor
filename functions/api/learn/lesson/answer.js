/**
 * Answer Question API
 * POST /api/learn/lesson/answer
 * 
 * Submits an answer for a question during a lesson
 * Returns immediate feedback and updates hearts/XP
 * 
 * Uses gpt-5-mini for short/long answer grading
 */

import { parseSessionCookie, hashToken } from '../../../../shared/auth.js';

const GRADING_MODEL = 'gpt-5-mini'; // User selected model for grading

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
  const userBlanksArray = Array.isArray(userAnswers) ? userAnswers : [userAnswers];
  
  let correctCount = 0;
  const results = correctBlanks.map((correct, i) => {
    const userAns = (userBlanksArray[i] || '').trim().toLowerCase();
    const correctAns = correct.toLowerCase().trim();
    
    // Allow some flexibility in matching
    const isMatch = userAns === correctAns || 
                    correctAns.includes(userAns) || 
                    userAns.includes(correctAns);
    
    if (isMatch) correctCount++;
    
    return { 
      userAnswer: userBlanksArray[i], 
      correctAnswer: correct, 
      isCorrect: isMatch 
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

// Grade short/long answer using AI
async function gradeTextAnswer(question, userAnswer, env) {
  const openaiKey = env.OPENAI_API_KEY;
  if (!openaiKey) {
    // Fallback: always accept text answers as needing review
    return {
      isCorrect: true,
      needsReview: true,
      feedback: 'Answer submitted for review',
    };
  }
  
  const modelAnswer = question.parsed.modelAnswer || 
                      question.parsed.parts?.map(p => p.modelAnswer).join('\n\n') || '';
  const markingScheme = question.parsed.markingScheme || [];
  
  const prompt = `You are a HKDSE Physics teacher grading a student's answer.

Question: ${question.parsed.question}

Model Answer: ${modelAnswer}

Marking Scheme: ${JSON.stringify(markingScheme)}

Student's Answer: ${userAnswer}

Grade this answer. Be encouraging but accurate. Consider partial credit.

Respond with JSON only:
{
  "score": <0-100>,
  "isCorrect": <true if score >= 60>,
  "feedback": "Brief encouraging feedback",
  "keyPointsMissed": ["List of key points the student missed"],
  "improvement": "One suggestion for improvement"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: GRADING_MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful HKDSE Physics teacher. Grade fairly and provide encouraging feedback. Respond with JSON only.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { isCorrect: true, needsReview: true, feedback: 'Answer submitted' };
  } catch (err) {
    console.error('Grading error:', err);
    return { isCorrect: true, needsReview: true, feedback: 'Answer submitted for review' };
  }
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
    
    // Calculate XP
    let xpEarned = 0;
    if (result.isCorrect) {
      xpEarned = 10; // Base XP for correct answer
      
      // Streak bonus could be added here
    }
    
    // Update hearts if wrong
    let currentHearts = null;
    if (!result.isCorrect) {
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

