/**
 * HKDSE Physics AI Tutor - Token Usage Tracking
 * Utility functions for recording LLM API token usage
 */

import { generateId } from './auth.js';

/**
 * Save token usage to the database
 * @param {D1Database} db - Cloudflare D1 database
 * @param {string|null} userId - User ID (null for anonymous)
 * @param {string} model - Model name ('deepseek' or 'qwen-vl')
 * @param {object} usage - Token usage object from API response
 * @param {string} endpoint - API endpoint name
 */
export async function saveTokenUsage(db, userId, model, usage, endpoint) {
  if (!db || !usage) return;

  try {
    const id = generateId();
    const promptTokens = usage.prompt_tokens || usage.input_tokens || 0;
    const completionTokens = usage.completion_tokens || usage.output_tokens || 0;
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

    await db.prepare(`
      INSERT INTO token_usage (id, user_id, model, prompt_tokens, completion_tokens, total_tokens, endpoint)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, userId, model, promptTokens, completionTokens, totalTokens, endpoint).run();

    console.log(`Token usage saved: ${model} - ${totalTokens} tokens for ${endpoint}`);
  } catch (err) {
    // Don't fail the request if token tracking fails
    console.error('Failed to save token usage:', err);
  }
}

/**
 * Get total token usage statistics
 * @param {D1Database} db - Cloudflare D1 database
 */
export async function getTokenStats(db) {
  try {
    // Total tokens by model
    const totalByModel = await db.prepare(`
      SELECT model, 
             SUM(total_tokens) as total_tokens,
             SUM(prompt_tokens) as prompt_tokens,
             SUM(completion_tokens) as completion_tokens,
             COUNT(*) as request_count
      FROM token_usage
      GROUP BY model
    `).all();

    // Today's tokens
    const todayByModel = await db.prepare(`
      SELECT model,
             SUM(total_tokens) as total_tokens,
             COUNT(*) as request_count
      FROM token_usage
      WHERE date(created_at) = date('now')
      GROUP BY model
    `).all();

    // Total overall
    const totalOverall = await db.prepare(`
      SELECT SUM(total_tokens) as total_tokens,
             SUM(prompt_tokens) as prompt_tokens,
             SUM(completion_tokens) as completion_tokens,
             COUNT(*) as request_count
      FROM token_usage
    `).first();

    return {
      byModel: totalByModel.results || [],
      todayByModel: todayByModel.results || [],
      overall: totalOverall || { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, request_count: 0 }
    };
  } catch (err) {
    console.error('Failed to get token stats:', err);
    return {
      byModel: [],
      todayByModel: [],
      overall: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, request_count: 0 }
    };
  }
}

/**
 * Get token usage for a specific user
 * @param {D1Database} db - Cloudflare D1 database
 * @param {string} userId - User ID
 */
export async function getUserTokenUsage(db, userId) {
  try {
    const result = await db.prepare(`
      SELECT SUM(total_tokens) as total_tokens,
             SUM(prompt_tokens) as prompt_tokens,
             SUM(completion_tokens) as completion_tokens,
             COUNT(*) as request_count
      FROM token_usage
      WHERE user_id = ?
    `).bind(userId).first();

    return result || { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, request_count: 0 };
  } catch (err) {
    console.error('Failed to get user token usage:', err);
    return { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, request_count: 0 };
  }
}
