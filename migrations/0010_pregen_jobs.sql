-- Pregen Jobs: Track question generation tasks for admin monitoring
-- Shows progress, logs, and errors in a terminal-like view

CREATE TABLE IF NOT EXISTS pregen_jobs (
    id TEXT PRIMARY KEY,
    subtopic TEXT NOT NULL,            -- subtopic id being generated for
    language TEXT NOT NULL,            -- 'en' or 'zh'
    qtype TEXT NOT NULL,               -- 'mc', 'short', 'long'
    difficulty INTEGER DEFAULT 3,      -- target difficulty
    target_count INTEGER NOT NULL,     -- how many questions to generate
    completed_count INTEGER DEFAULT 0, -- successfully generated and stored
    failed_count INTEGER DEFAULT 0,    -- failed to generate or validate
    status TEXT DEFAULT 'pending',     -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    logs TEXT DEFAULT '',              -- Append-only log text (terminal-style)
    error_message TEXT,                -- Final error message if failed
    started_at INTEGER,                -- epoch ms when started
    finished_at INTEGER,               -- epoch ms when finished
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Index for listing jobs by status
CREATE INDEX IF NOT EXISTS idx_pregen_jobs_status ON pregen_jobs(status);

-- Index for recent jobs
CREATE INDEX IF NOT EXISTS idx_pregen_jobs_created ON pregen_jobs(created_at DESC);
