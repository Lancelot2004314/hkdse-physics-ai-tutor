-- Quests System: Daily Quests, Quest Progress, and Rewards
-- Migration for HKDSE Physics AI Tutor

-- ============================================
-- 1. Quest Definitions (Static quest types)
-- ============================================

CREATE TABLE IF NOT EXISTS quest_definitions (
    id TEXT PRIMARY KEY,                    -- e.g., 'daily-xp-10', 'daily-lessons-3'
    quest_type TEXT NOT NULL,               -- 'daily', 'weekly', 'monthly', 'achievement'
    name TEXT NOT NULL,                     -- e.g., 'Earn 10 XP'
    name_zh TEXT,                           -- 中文名稱
    description TEXT,
    description_zh TEXT,
    icon TEXT,                              -- Emoji icon
    criteria_type TEXT NOT NULL,            -- 'xp', 'lessons', 'perfect_lessons', 'streak', 'login'
    criteria_value INTEGER NOT NULL,        -- Target value to complete
    reward_type TEXT NOT NULL,              -- 'gems', 'xp', 'hearts', 'streak_freeze'
    reward_amount INTEGER NOT NULL,         -- Amount of reward
    unlock_condition TEXT,                  -- JSON: conditions to unlock this quest
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- ============================================
-- 2. User Quest Progress (tracks daily progress)
-- ============================================

CREATE TABLE IF NOT EXISTS user_quest_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    quest_date TEXT NOT NULL,               -- YYYY-MM-DD for daily, YYYY-WW for weekly
    current_value INTEGER DEFAULT 0,        -- Current progress
    target_value INTEGER NOT NULL,          -- Target to complete
    is_completed INTEGER DEFAULT 0,
    is_claimed INTEGER DEFAULT 0,           -- Whether reward has been claimed
    completed_at INTEGER,                   -- Epoch ms when completed
    claimed_at INTEGER,                     -- Epoch ms when claimed
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(user_id, quest_id, quest_date),
    FOREIGN KEY (quest_id) REFERENCES quest_definitions(id)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user_date 
    ON user_quest_progress(user_id, quest_date);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_claim
    ON user_quest_progress(user_id, is_completed, is_claimed);

-- ============================================
-- 3. User Gems/Currency System
-- ============================================

CREATE TABLE IF NOT EXISTS user_currency (
    user_id TEXT PRIMARY KEY,
    gems INTEGER DEFAULT 0,                 -- Premium currency
    coins INTEGER DEFAULT 0,                -- Regular currency (future use)
    streak_freezes INTEGER DEFAULT 0,       -- Streak freeze items
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- ============================================
-- 4. Currency Transaction History
-- ============================================

CREATE TABLE IF NOT EXISTS currency_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    currency_type TEXT NOT NULL,            -- 'gems', 'coins', 'streak_freezes'
    amount INTEGER NOT NULL,                -- Positive = add, negative = spend
    balance_after INTEGER NOT NULL,         -- Balance after transaction
    source TEXT NOT NULL,                   -- 'quest', 'purchase', 'shop', 'admin', 'achievement'
    source_id TEXT,                         -- Reference ID (quest_id, purchase_id, etc.)
    description TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_user 
    ON currency_transactions(user_id, created_at DESC);

-- ============================================
-- 5. Insert Default Daily Quests
-- ============================================

INSERT OR IGNORE INTO quest_definitions (id, quest_type, name, name_zh, icon, criteria_type, criteria_value, reward_type, reward_amount, display_order) VALUES
    ('daily-xp-10', 'daily', 'Earn 10 XP', '獲得 10 XP', '⚡', 'xp', 10, 'gems', 5, 1),
    ('daily-lessons-3', 'daily', 'Complete 3 Lessons', '完成 3 個課程', '📚', 'lessons', 3, 'gems', 10, 2),
    ('daily-perfect-1', 'daily', 'Complete a Perfect Lesson', '完成一個完美課程', '⭐', 'perfect_lessons', 1, 'gems', 20, 3),
    ('daily-xp-50', 'daily', 'Earn 50 XP', '獲得 50 XP', '🔥', 'xp', 50, 'gems', 15, 4),
    ('daily-lessons-5', 'daily', 'Complete 5 Lessons', '完成 5 個課程', '🎯', 'lessons', 5, 'gems', 25, 5);

-- Weekly quests
INSERT OR IGNORE INTO quest_definitions (id, quest_type, name, name_zh, icon, criteria_type, criteria_value, reward_type, reward_amount, display_order, unlock_condition) VALUES
    ('weekly-xp-200', 'weekly', 'Earn 200 XP this week', '本週獲得 200 XP', '💪', 'xp', 200, 'gems', 50, 10, '{"min_level": 2}'),
    ('weekly-streak-7', 'weekly', 'Maintain 7-day streak', '維持 7 天連續學習', '🔥', 'streak', 7, 'gems', 100, 11, '{"min_level": 1}'),
    ('weekly-perfect-5', 'weekly', 'Get 5 Perfect Lessons', '完成 5 個完美課程', '🌟', 'perfect_lessons', 5, 'gems', 75, 12, '{"min_level": 3}');


