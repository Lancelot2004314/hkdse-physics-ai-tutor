/**
 * Quiz Submit API
 * Grades answers and saves results
 */

import { GRADE_SHORT_ANSWER_PROMPT, MATH_GRADE_SHORT_ANSWER_PROMPT } from '../../../shared/prompts.js';
import { calculateGrade } from '../../../shared/topics.js';
import { getUserFromSession } from '../../../shared/auth.js';
import { saveTokenUsage } from '../../../shared/tokenUsage.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { sessionId, answers, timeSpent } = body;

    if (!sessionId || !answers) {
      return errorResponse(400, 'Session ID and answers are required');
    }

    const user = await getUserFromSession(request, env);
    if (!user) {
      return errorResponse(401, 'Please login');
    }

    if (!env.DB) {
      return errorResponse(500, 'Database not configured');
    }

    // Get session
    const session = await env.DB.prepare(`
      SELECT * FROM quiz_sessions WHERE id = ? AND user_id = ?
    `).bind(sessionId, user.id).first();

    if (!session) {
      return errorResponse(404, 'Quiz session not found');
    }

    if (session.status === 'completed') {
      return errorResponse(400, 'Quiz already submitted');
    }

    const questions = JSON.parse(session.questions || '[]');
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Helper: check if answer is gibberish (repeated chars, random letters, etc.)
    const isGibberish = (text) => {
      const t = text.toLowerCase();
      if (/^(.)\1{2,}$/.test(t)) return true; // Repeated chars
      if (/^(qwerty|asdf|zxcv|qazwsx|abc|xyz|test|hello|hi|ok|no|yes|idk|lol|haha|what|why|how|help)$/i.test(t)) return true;
      if (t.length <= 5 && !/[\d\u4e00-\u9fff+\-=×÷√∑∫]/.test(t)) return true;
      if (/^[a-z]{2,6}$/i.test(t) && !/^(up|down|left|right|yes|no|true|false|zero|one|two)$/i.test(t)) return true;
      return false;
    };

    // Grade a single question - returns { score, feedback, isCorrect, usage }
    const gradeQuestion = async (question, userAnswer, index) => {
      let score = 0;
      let feedback = '';
      let isCorrect = false;
      let usage = null;

      console.log(`[Quiz] Q${index + 1}: type=${question.type}, score=${question.score}, answer="${userAnswer?.substring(0, 30)}"`);

      if (question.type === 'mc') {
        // Auto-grade MC (instant - no API)
        const userAns = (userAnswer || '').trim().toUpperCase();
        const correctAns = (question.correctAnswer || '').trim().toUpperCase();
        isCorrect = userAns === correctAns;
        score = isCorrect ? (question.score || 1) : 0;
        feedback = isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${question.correctAnswer}.`;
      } else if (question.type === 'short' || question.type === 'long') {
        const maxQuestionScore = question.score || question.parts?.reduce((s, p) => s + p.marks, 0) || 5;
        const isMathQuestion = question.topic?.startsWith('math_') || 
                               question.subject === 'Mathematics' ||
                               session.subject === 'Mathematics';
        const trimmedAnswer = userAnswer.trim();
        
        // LOCAL CHECK - no API call needed for obviously invalid answers
        let isObviouslyInvalid = !trimmedAnswer;
        let invalidReason = '';

        if (!isObviouslyInvalid && isGibberish(trimmedAnswer)) {
          isObviouslyInvalid = true;
          invalidReason = 'Answer appears to be gibberish or irrelevant';
        } else if (!isObviouslyInvalid && !isMathQuestion) {
          if (trimmedAnswer.length < 10) {
            isObviouslyInvalid = true;
            invalidReason = 'Answer too short for physics question';
          } else if (/^[\d\s,.]+$/.test(trimmedAnswer)) {
            isObviouslyInvalid = true;
            invalidReason = 'Just numbers - physics requires explanation';
          }
        } else if (!isObviouslyInvalid && isMathQuestion) {
          if (/^[^a-zA-Z0-9\u4e00-\u9fff\-+=()\s,.$√∑∫×÷]+$/.test(trimmedAnswer)) {
            isObviouslyInvalid = true;
            invalidReason = 'Contains only special characters';
          }
        }

        if (isObviouslyInvalid) {
          score = 0;
          feedback = trimmedAnswer ? (invalidReason || 'Answer appears invalid') : 'No answer provided - 0 marks';
          console.log(`[Quiz] Q${index + 1}: Invalid (local): "${trimmedAnswer}" => 0. Reason: ${invalidReason}`);
        } else {
          // AI grading needed - directly use DeepSeek (skip pre-validation for speed)
          const modelAnswer = question.modelAnswer || question.parts?.map(p => p.modelAnswer).join('\n');
          const gradeResult = await gradeShortAnswer(
            env.DEEPSEEK_API_KEY,
            userAnswer,
            modelAnswer,
            question.markingScheme || question.parts?.map(p => `${p.marks} marks: ${p.question}`).join('\n'),
            maxQuestionScore,
            isMathQuestion
          );

          if (gradeResult.success) {
            score = Math.min(Math.max(gradeResult.score || 0, 0), maxQuestionScore);
            feedback = gradeResult.feedback || 'Graded by AI';
            usage = gradeResult.usage;
            console.log(`[Quiz] Q${index + 1} graded: ${score}/${maxQuestionScore}`);
          } else {
            score = 0;
            feedback = gradeResult.feedback || 'Grading failed - 0 marks';
          }
        }
        isCorrect = score >= maxQuestionScore * 0.5;
      }

      return {
        questionIndex: index,
        userAnswer,
        correctAnswer: question.correctAnswer || question.modelAnswer,
        score,
        maxScore: question.score || 1,
        isCorrect,
        feedback,
        explanation: question.explanation,
        usage,
      };
    };

    // Grade ALL questions in PARALLEL for speed
    console.log(`[Quiz] Starting PARALLEL grading for ${questions.length} questions`);
    const gradingPromises = questions.map((question, i) => gradeQuestion(question, answers[i] || '', i));
    const results = await Promise.all(gradingPromises);

    // Aggregate results
    let totalScore = 0;
    for (const r of results) {
      totalScore += r.score;
      if (r.usage) {
        totalUsage.prompt_tokens += r.usage.prompt_tokens || 0;
        totalUsage.completion_tokens += r.usage.completion_tokens || 0;
        totalUsage.total_tokens += r.usage.total_tokens || 0;
      }
      console.log(`[Quiz] Q${r.questionIndex + 1} result: ${r.score}/${r.maxScore}, correct=${r.isCorrect}`);
    }

    // Log final summary
    const correctCount = results.filter(r => r.isCorrect).length;
    console.log(`[Quiz] FINAL: totalScore=${totalScore}/${session.max_score}, correct=${correctCount}/${questions.length}`);
    console.log(`[Quiz] Score breakdown:`, results.map(r => `Q${r.questionIndex + 1}: ${r.score}/${r.maxScore}`).join(', '));

    // Calculate grade
    const percentage = session.max_score > 0 ? (totalScore / session.max_score) * 100 : 0;
    const grade = calculateGrade(percentage);

    // Update session with grading results
    await env.DB.prepare(`
      UPDATE quiz_sessions SET
        answers = ?,
        score = ?,
        grade = ?,
        time_spent = ?,
        grading_results = ?,
        status = 'completed',
        completed_at = datetime('now')
      WHERE id = ?
    `).bind(
      JSON.stringify(answers),
      totalScore,
      grade,
      timeSpent || 0,
      JSON.stringify(results),
      sessionId
    ).run();

    // Update user scores
    await updateUserScores(env.DB, user.id, totalScore, questions.length, percentage >= 50);

    // Track token usage
    if (totalUsage.total_tokens > 0) {
      await saveTokenUsage(env.DB, user.id, 'deepseek', totalUsage, 'quiz-grade');
    }

    return new Response(JSON.stringify({
      score: totalScore,
      maxScore: session.max_score,
      percentage: Math.round(percentage),
      grade,
      results,
      timeSpent,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in quiz/submit:', err);
    return errorResponse(500, 'Failed to submit quiz');
  }
}

/**
 * Quick pre-validation using Qwen-turbo (fast & cheap)
 * Checks if the answer is relevant to the question and model answer
 * Returns { isRelevant: boolean, reason: string }
 */
async function quickValidateAnswer(apiKey, studentAnswer, modelAnswer, questionText) {
  // If no API key, skip validation and proceed to detailed grading
  if (!apiKey) {
    console.log('[QuickValidate] No Qwen API key, skipping pre-validation');
    return { isRelevant: true, reason: 'Validation skipped' };
  }

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-turbo', // Fast and cheap for quick validation
        messages: [
          {
            role: 'system',
            content: `You are a strict physics answer validator. Your job is to quickly determine if a student's answer is RELEVANT to the physics question.

RESPOND WITH JSON ONLY:
{"isRelevant": true/false, "reason": "brief explanation"}

IRRELEVANT means:
- Random numbers/letters with no physics meaning (e.g., "12345", "abc")
- Completely off-topic content
- Gibberish or nonsense
- Answer shows zero understanding of the question

RELEVANT means:
- Answer attempts to address the physics question
- Uses physics terms/concepts (even if wrong)
- Shows some understanding of what is being asked

Be STRICT: If answer looks like random input, mark as irrelevant.`
          },
          {
            role: 'user',
            content: `QUESTION: ${questionText?.substring(0, 500) || 'N/A'}

MODEL ANSWER (for reference): ${modelAnswer?.substring(0, 300) || 'N/A'}

STUDENT ANSWER: ${studentAnswer}

Is this student answer RELEVANT to the physics question? Respond with JSON only.`
          }
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error('[QuickValidate] API error:', response.status);
      return { isRelevant: true, reason: 'Validation error, proceeding to grading' };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        isRelevant: result.isRelevant === true,
        reason: result.reason || 'No reason provided'
      };
    }

    // Fallback: if can't parse, assume relevant
    return { isRelevant: true, reason: 'Could not parse validation result' };

  } catch (err) {
    console.error('[QuickValidate] Error:', err);
    return { isRelevant: true, reason: 'Validation error' };
  }
}

async function gradeShortAnswer(apiKey, studentAnswer, modelAnswer, markingScheme, maxScore, isMathQuestion = false) {
  if (!apiKey) {
    console.log('[Grading] No API key available');
    return { success: false, score: 0, feedback: 'Grading unavailable' };
  }

  console.log('[Grading] Starting grading for answer:', studentAnswer.substring(0, 100) + '...');
  console.log('[Grading] Max score:', maxScore, ', isMath:', isMathQuestion);

  // Choose the appropriate prompt based on subject
  const basePrompt = isMathQuestion ? MATH_GRADE_SHORT_ANSWER_PROMPT : GRADE_SHORT_ANSWER_PROMPT;
  const prompt = basePrompt
    .replace('{studentAnswer}', studentAnswer)
    .replace('{modelAnswer}', modelAnswer || 'N/A')
    .replace('{markingScheme}', Array.isArray(markingScheme) ? markingScheme.join('\n') : markingScheme || 'N/A')
    .replace('{maxScore}', maxScore);

  // System prompt based on subject
  const systemPrompt = isMathQuestion 
    ? 'You are a fair HKDSE Mathematics examiner. Focus on mathematical correctness. Accept answers in any language (Chinese/English) if the meaning is correct. Award marks for correct final answers even without full working.'
    : 'You are a STRICT HKDSE Physics examiner. Grade accurately - do NOT give marks for wrong answers or effort alone. Only award marks for correct physics content.';

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1, // Lower temperature for more consistent grading
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      console.error('[Grading] API error:', response.status);
      return { success: false, score: 0, feedback: 'Grading failed' };
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';
    console.log('[Grading] AI response:', text.substring(0, 200) + '...');

    // Parse grading result
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const finalScore = Math.min(Math.max(result.score || 0, 0), maxScore); // Ensure score is between 0 and maxScore

      console.log('[Grading] Parsed score:', result.score, '-> Final score:', finalScore, '/', maxScore);
      console.log('[Grading] Breakdown:', JSON.stringify(result.breakdown || []));

      return {
        success: true,
        score: finalScore,
        feedback: result.feedback || '',
        breakdown: result.breakdown || [],
        usage: data.usage,
      };
    }

    console.error('[Grading] Failed to parse JSON from:', text);
    return { success: false, score: 0, feedback: 'Failed to parse grade' };
  } catch (err) {
    console.error('[Grading] Error:', err);
    return { success: false, score: 0, feedback: 'Grading error' };
  }
}

async function updateUserScores(db, userId, points, questionsCount, isPass) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if user has scores record
    const existing = await db.prepare(`
      SELECT * FROM user_scores WHERE user_id = ?
    `).bind(userId).first();

    if (existing) {
      // Calculate streak
      let newStreak = existing.current_streak || 0;
      let bestStreak = existing.best_streak || 0;
      const lastPracticeDate = existing.last_practice_date;

      if (lastPracticeDate) {
        const lastDate = new Date(lastPracticeDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Same day - streak stays the same
        } else if (diffDays === 1) {
          // Consecutive day - increase streak
          newStreak += 1;
        } else {
          // Streak broken - reset to 1
          newStreak = 1;
        }
      } else {
        // First practice ever
        newStreak = 1;
      }

      // Update best streak if needed
      if (newStreak > bestStreak) {
        bestStreak = newStreak;
      }

      await db.prepare(`
        UPDATE user_scores SET
          total_points = total_points + ?,
          correct_count = correct_count + ?,
          total_attempts = total_attempts + ?,
          current_streak = ?,
          best_streak = ?,
          last_practice_date = ?,
          updated_at = datetime('now')
        WHERE user_id = ?
      `).bind(
        points,
        isPass ? 1 : 0,
        1, // Increment by 1 practice session, not by question count
        newStreak,
        bestStreak,
        today,
        userId
      ).run();
    } else {
      // New user - create record with streak = 1
      await db.prepare(`
        INSERT INTO user_scores (
          user_id, total_points, correct_count, total_attempts,
          current_streak, best_streak, last_practice_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        points,
        isPass ? 1 : 0,
        1, // First practice session
        1, // First day streak
        1, // Best streak starts at 1
        today
      ).run();
    }
  } catch (err) {
    console.error('Failed to update user scores:', err);
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}




