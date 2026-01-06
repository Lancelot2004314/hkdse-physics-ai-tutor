/**
 * Hearts API
 * GET /api/learn/hearts - Get current hearts
 * POST /api/learn/hearts - Refill hearts (practice to earn)
 */

import { HEARTS_CONFIG } from '../../../shared/skillTreeConfig.js';
import { parseSessionCookie, hashToken } from '../../../shared/auth.js';

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

// Get or create user hearts
async function getOrCreateHearts(db, userId) {
  let hearts = await db.prepare(
    'SELECT * FROM user_hearts WHERE user_id = ?'
  ).bind(userId).first();
  
  if (!hearts) {
    await db.prepare(`
      INSERT INTO user_hearts (user_id, hearts, max_hearts, last_refill_at)
      VALUES (?, ?, ?, ?)
    `).bind(userId, HEARTS_CONFIG.maxHearts, HEARTS_CONFIG.maxHearts, Date.now()).run();
    
    hearts = {
      user_id: userId,
      hearts: HEARTS_CONFIG.maxHearts,
      max_hearts: HEARTS_CONFIG.maxHearts,
      last_refill_at: Date.now(),
      unlimited_until: null,
    };
  }
  
  return hearts;
}

// Calculate hearts with time-based refill
function calculateHearts(hearts) {
  const now = Date.now();
  
  // Check if unlimited
  if (hearts.unlimited_until && hearts.unlimited_until > now) {
    return {
      current: hearts.max_hearts,
      max: hearts.max_hearts,
      unlimited: true,
      unlimitedUntil: hearts.unlimited_until,
    };
  }
  
  // Calculate time-based refill
  const timeSinceRefill = now - (hearts.last_refill_at || 0);
  const heartsToAdd = Math.floor(timeSinceRefill / HEARTS_CONFIG.refillIntervalMs);
  
  let currentHearts = Math.min(
    hearts.max_hearts,
    hearts.hearts + heartsToAdd
  );
  
  // Calculate time until next refill
  let nextRefillAt = null;
  if (currentHearts < hearts.max_hearts) {
    const timeSinceLastRefill = timeSinceRefill % HEARTS_CONFIG.refillIntervalMs;
    nextRefillAt = now + (HEARTS_CONFIG.refillIntervalMs - timeSinceLastRefill);
  }
  
  return {
    current: currentHearts,
    max: hearts.max_hearts,
    unlimited: false,
    nextRefillAt,
    refillIntervalMs: HEARTS_CONFIG.refillIntervalMs,
  };
}

// GET hearts
export async function onRequestGet({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const heartsData = await getOrCreateHearts(env.DB, user.id);
    const calculated = calculateHearts(heartsData);
    
    // Update database if hearts were refilled
    if (calculated.current !== heartsData.hearts && !calculated.unlimited) {
      await env.DB.prepare(`
        UPDATE user_hearts SET hearts = ?, last_refill_at = ? WHERE user_id = ?
      `).bind(calculated.current, Date.now(), user.id).run();
    }
    
    return Response.json({
      success: true,
      hearts: calculated,
    });
    
  } catch (err) {
    console.error('Hearts GET error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST hearts (refill or use)
export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { action, amount = 1 } = body;
    
    const heartsData = await getOrCreateHearts(env.DB, user.id);
    const calculated = calculateHearts(heartsData);
    
    switch (action) {
      case 'use':
        // Lose hearts (already handled in lesson/answer API)
        // This is for manual deduction if needed
        if (calculated.unlimited) {
          return Response.json({
            success: true,
            hearts: calculated,
            message: 'Unlimited hearts active',
          });
        }
        
        const newHearts = Math.max(0, calculated.current - amount);
        await env.DB.prepare(`
          UPDATE user_hearts SET hearts = ?, updated_at = ? WHERE user_id = ?
        `).bind(newHearts, Date.now(), user.id).run();
        
        return Response.json({
          success: true,
          hearts: {
            ...calculated,
            current: newHearts,
          },
          heartsUsed: amount,
        });
        
      case 'practice':
        // Earn hearts by completing practice (not during lessons)
        // Requires completing a "heart practice" session
        if (calculated.current >= calculated.max) {
          return Response.json({
            success: false,
            error: 'Hearts already full',
            hearts: calculated,
          });
        }
        
        // Award 1 heart for practice
        const newHeartsAfterPractice = Math.min(calculated.max, calculated.current + 1);
        await env.DB.prepare(`
          UPDATE user_hearts SET hearts = ?, updated_at = ? WHERE user_id = ?
        `).bind(newHeartsAfterPractice, Date.now(), user.id).run();
        
        return Response.json({
          success: true,
          hearts: {
            ...calculated,
            current: newHeartsAfterPractice,
          },
          heartsEarned: 1,
        });
        
      case 'refill':
        // Instant refill (could require watching ad, paying gems, etc.)
        // For now, just refill to max
        await env.DB.prepare(`
          UPDATE user_hearts SET hearts = ?, last_refill_at = ?, updated_at = ? WHERE user_id = ?
        `).bind(calculated.max, Date.now(), Date.now(), user.id).run();
        
        return Response.json({
          success: true,
          hearts: {
            ...calculated,
            current: calculated.max,
          },
          refilled: true,
        });
        
      case 'unlimited':
        // Grant unlimited hearts for a period
        const durationHours = body.hours || 24;
        const unlimitedUntil = Date.now() + durationHours * 60 * 60 * 1000;
        
        await env.DB.prepare(`
          UPDATE user_hearts SET unlimited_until = ?, updated_at = ? WHERE user_id = ?
        `).bind(unlimitedUntil, Date.now(), user.id).run();
        
        return Response.json({
          success: true,
          hearts: {
            current: calculated.max,
            max: calculated.max,
            unlimited: true,
            unlimitedUntil,
          },
        });
        
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (err) {
    console.error('Hearts POST error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

