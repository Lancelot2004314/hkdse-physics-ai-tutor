-- Practice & Leaderboard System Migration
-- Created: 2024-12-19

-- User scores and stats for gamification
CREATE TABLE IF NOT EXISTS user_scores (
    user_id TEXT PRIMARY KEY,
    total_points INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    last_practice_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Practice history for tracking questions and answers
CREATE TABLE IF NOT EXISTS practice_history (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    original_question TEXT NOT NULL,
    generated_question TEXT NOT NULL,
    options TEXT, -- JSON array of options
    user_answer TEXT,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    points_earned INTEGER NOT NULL DEFAULT 0,
    topic TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_scores_points ON user_scores(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_scores_streak ON user_scores(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_user_scores_last_practice ON user_scores(last_practice_date);

-- Indexes for practice history
CREATE INDEX IF NOT EXISTS idx_practice_history_user ON practice_history(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_history_date ON practice_history(created_at);
CREATE INDEX IF NOT EXISTS idx_practice_history_topic ON practice_history(topic);
