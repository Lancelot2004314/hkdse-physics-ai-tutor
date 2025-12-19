-- Token Usage Tracking Table
-- Run with: wrangler d1 execute hkdse-physics-tutor-db --file=./migrations/0002_token_usage.sql --remote

CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT,                    -- Can be NULL for anonymous users
    model TEXT NOT NULL,             -- 'deepseek' or 'qwen-vl'
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    endpoint TEXT NOT NULL,          -- 'explain-image', 'explain-text', 'followup'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_endpoint ON token_usage(endpoint);
