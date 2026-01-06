-- Duolingo-style Learning System: Skill Tree + Progress + Hearts + Achievements
-- Migration for Physics Learning System based on DSE Curriculum

-- ============================================
-- 1. Extend question_bank for learning system
-- ============================================

-- AI-calibrated difficulty (1-5 scale, more accurate than original difficulty)
ALTER TABLE question_bank ADD COLUMN calibrated_difficulty INTEGER;

-- Reference to skill tree node (e.g., 'heat-1a', 'motion-2b')
ALTER TABLE question_bank ADD COLUMN skill_node_id TEXT;

-- New question types for Duolingo-style learning
-- 'fill-in' = fill in the blank, 'matching' = match pairs, 'ordering' = arrange in order
ALTER TABLE question_bank ADD COLUMN learn_qtype TEXT;

-- Source question ID if this was converted from another question
ALTER TABLE question_bank ADD COLUMN source_question_id TEXT;

-- Index for learning system queries
CREATE INDEX IF NOT EXISTS idx_question_bank_learn 
    ON question_bank(skill_node_id, calibrated_difficulty, learn_qtype, status);

-- ============================================
-- 2. Skill Tree Nodes (22 nodes based on DSE Curriculum)
-- ============================================

CREATE TABLE IF NOT EXISTS skill_tree_nodes (
    id TEXT PRIMARY KEY,                    -- e.g., 'heat-1a', 'motion-2b'
    unit_id TEXT NOT NULL,                  -- e.g., 'unit-1', 'unit-2'
    unit_name TEXT NOT NULL,                -- e.g., 'Heat and Gases'
    unit_name_zh TEXT,                      -- 中文名稱
    node_name TEXT NOT NULL,                -- e.g., 'Temperature, Heat and Internal Energy'
    node_name_zh TEXT,                      -- 中文名稱
    description TEXT,                       -- Brief description
    display_order INTEGER,                  -- Order in skill tree display
    prerequisite_ids TEXT,                  -- JSON array of prerequisite node IDs
    curriculum_reference TEXT,              -- Reference to C&A Guide page
    suggested_hours INTEGER,                -- Suggested learning hours from curriculum
    icon TEXT,                              -- Icon name for UI
    color TEXT,                             -- Color code for UI
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- ============================================
-- 3. User Skill Progress
-- ============================================

CREATE TABLE IF NOT EXISTS user_skill_progress (
    user_id TEXT NOT NULL,
    skill_node_id TEXT NOT NULL,
    current_level INTEGER DEFAULT 0,        -- 0-5 (0=locked, 1-5=skill levels)
    xp_earned INTEGER DEFAULT 0,            -- Total XP earned in this skill
    lessons_completed INTEGER DEFAULT 0,    -- Number of lessons completed
    perfect_lessons INTEGER DEFAULT 0,      -- Lessons with 100% accuracy
    current_streak INTEGER DEFAULT 0,       -- Current correct answer streak
    best_streak INTEGER DEFAULT 0,          -- Best streak ever
    last_practiced_at INTEGER,              -- Epoch ms
    next_review_at INTEGER,                 -- Epoch ms (for spaced repetition)
    strength REAL DEFAULT 1.0,              -- Skill strength 0.0-1.0 (decays over time)
    PRIMARY KEY (user_id, skill_node_id),
    FOREIGN KEY (skill_node_id) REFERENCES skill_tree_nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_user_skill_progress_review 
    ON user_skill_progress(user_id, next_review_at);

-- ============================================
-- 4. User Hearts System
-- ============================================

CREATE TABLE IF NOT EXISTS user_hearts (
    user_id TEXT PRIMARY KEY,
    hearts INTEGER DEFAULT 5,               -- Current hearts (max 5)
    max_hearts INTEGER DEFAULT 5,           -- Maximum hearts
    last_refill_at INTEGER,                 -- Epoch ms when last heart was refilled
    unlimited_until INTEGER,                -- Epoch ms (premium feature: unlimited hearts)
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- ============================================
-- 5. Lesson Sessions
-- ============================================

CREATE TABLE IF NOT EXISTS lesson_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    skill_node_id TEXT NOT NULL,
    lesson_type TEXT DEFAULT 'practice',    -- 'practice', 'review', 'test', 'challenge'
    difficulty INTEGER,                     -- Target difficulty 1-5
    started_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    completed_at INTEGER,
    questions_total INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    hearts_lost INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    xp_bonus INTEGER DEFAULT 0,             -- Bonus XP (perfect, streak, etc.)
    is_perfect INTEGER DEFAULT 0,           -- 1 if no mistakes
    question_ids TEXT,                      -- JSON array of question IDs used
    answers TEXT,                           -- JSON array of user answers
    status TEXT DEFAULT 'in_progress',      -- 'in_progress', 'completed', 'abandoned'
    FOREIGN KEY (skill_node_id) REFERENCES skill_tree_nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_sessions_user 
    ON lesson_sessions(user_id, status, started_at);

-- ============================================
-- 6. Achievements / Badges
-- ============================================

CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_zh TEXT,
    description TEXT,
    description_zh TEXT,
    badge_icon TEXT,                        -- Icon name or URL
    badge_color TEXT,                       -- Badge color
    criteria_type TEXT NOT NULL,            -- 'lessons', 'streak', 'perfect', 'xp', 'unit_complete', etc.
    criteria_value INTEGER NOT NULL,        -- Threshold value
    criteria_extra TEXT,                    -- JSON for additional criteria
    xp_reward INTEGER DEFAULT 0,            -- XP awarded when earned
    tier INTEGER DEFAULT 1,                 -- 1=bronze, 2=silver, 3=gold
    display_order INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS user_achievements (
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    earned_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    notified INTEGER DEFAULT 0,             -- 1 if user has been notified
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

-- ============================================
-- 7. Daily Goals & Streaks
-- ============================================

CREATE TABLE IF NOT EXISTS user_daily_progress (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,                     -- YYYY-MM-DD format
    xp_earned INTEGER DEFAULT 0,
    lessons_completed INTEGER DEFAULT 0,
    goal_xp INTEGER DEFAULT 50,             -- Daily XP goal
    goal_met INTEGER DEFAULT 0,             -- 1 if daily goal was met
    PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS user_streaks (
    user_id TEXT PRIMARY KEY,
    current_streak INTEGER DEFAULT 0,       -- Current day streak
    longest_streak INTEGER DEFAULT 0,       -- Longest streak ever
    last_active_date TEXT,                  -- YYYY-MM-DD
    streak_freeze_count INTEGER DEFAULT 0,  -- Streak freezes available
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- ============================================
-- 8. Weekly League / Leaderboard
-- ============================================

CREATE TABLE IF NOT EXISTS weekly_leagues (
    id TEXT PRIMARY KEY,                    -- Format: YYYY-WW (e.g., 2026-02)
    start_date TEXT NOT NULL,               -- YYYY-MM-DD
    end_date TEXT NOT NULL,                 -- YYYY-MM-DD
    status TEXT DEFAULT 'active',           -- 'active', 'completed'
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS league_participants (
    league_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    xp_earned INTEGER DEFAULT 0,
    rank INTEGER,
    tier TEXT DEFAULT 'bronze',             -- 'bronze', 'silver', 'gold', 'diamond'
    promotion_zone INTEGER DEFAULT 0,       -- 1 if in promotion zone
    demotion_zone INTEGER DEFAULT 0,        -- 1 if in demotion zone
    PRIMARY KEY (league_id, user_id),
    FOREIGN KEY (league_id) REFERENCES weekly_leagues(id)
);

CREATE INDEX IF NOT EXISTS idx_league_participants_rank 
    ON league_participants(league_id, xp_earned DESC);

-- ============================================
-- 9. User Overall Stats (extend user_scores)
-- ============================================

-- Add learning-specific columns to user_scores if not exists
-- Note: Some columns may already exist, ALTER will fail gracefully

-- Total XP from learning system
-- ALTER TABLE user_scores ADD COLUMN learn_total_xp INTEGER DEFAULT 0;

-- Learning streak
-- ALTER TABLE user_scores ADD COLUMN learn_current_streak INTEGER DEFAULT 0;

-- Highest skill level achieved
-- ALTER TABLE user_scores ADD COLUMN learn_max_skill_level INTEGER DEFAULT 0;


