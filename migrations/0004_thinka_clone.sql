-- Thinka Clone Database Migration
-- Complete quiz system with sessions, bookmarks, and extended user profiles

-- Quiz sessions table
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    topics TEXT,                    -- JSON array of selected topic IDs
    mc_count INTEGER DEFAULT 0,
    short_count INTEGER DEFAULT 0,
    long_count INTEGER DEFAULT 0,
    difficulty INTEGER DEFAULT 3,   -- 1-5 stars
    time_limit INTEGER DEFAULT 60,  -- minutes
    questions TEXT,                 -- JSON array of generated questions
    answers TEXT,                   -- JSON array of user answers
    score INTEGER DEFAULT 0,
    max_score INTEGER DEFAULT 0,
    grade TEXT,                     -- 5**, 5*, 5, 4, 3, 2, 1, U
    time_spent INTEGER DEFAULT 0,   -- seconds
    status TEXT DEFAULT 'in_progress', -- in_progress, completed, abandoned
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bookmarked questions table
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    question_index INTEGER,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,    -- mc, short, long
    options TEXT,                   -- JSON for MC options
    correct_answer TEXT,
    explanation TEXT,
    topic TEXT,
    difficulty INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE SET NULL
);

-- Flagged questions (for review during quiz)
CREATE TABLE IF NOT EXISTS flagged_questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    UNIQUE(session_id, question_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status ON quiz_sessions(status);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_created ON quiz_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_completed ON quiz_sessions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_topic ON bookmarks(topic);
CREATE INDEX IF NOT EXISTS idx_flagged_session ON flagged_questions(session_id);
