-- Question Bank Pool: Pre-generated questions for fast retrieval
-- Matching dimensions: subtopic + language + type(mc/short/long)

CREATE TABLE IF NOT EXISTS question_bank (
    id TEXT PRIMARY KEY,
    topic_key TEXT NOT NULL,           -- subtopic id (e.g., "1.1.1")
    language TEXT NOT NULL,            -- 'en' or 'zh'
    qtype TEXT NOT NULL,               -- 'mc', 'short', 'long'
    difficulty INTEGER DEFAULT 3,      -- 1-5 scale
    question_json TEXT NOT NULL,       -- Full question JSON (including correctAnswer/modelAnswer/markingScheme)
    status TEXT DEFAULT 'ready',       -- 'ready', 'reserved', 'used', 'bad'
    reserved_by TEXT,                  -- user_id who reserved this question
    reserved_at INTEGER,               -- epoch ms when reserved
    used_by TEXT,                      -- user_id who used this question
    used_at INTEGER,                   -- epoch ms when used
    kb_backend TEXT,                   -- 'vertex_rag', 'vectorize', 'none'
    rewrite_mode INTEGER DEFAULT 0,    -- 1 if used prototype rewrite mode
    prototype_sources TEXT,            -- JSON: [{sourceUri, year, paper, doc_type}]
    validator_meta TEXT,               -- JSON: {passedInitial, repairedCount, issues, ...}
    llm_model TEXT,                    -- Model used for generation (e.g., 'deepseek-reasoner')
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Primary index for pool queries: find ready questions by subtopic+language+type
CREATE INDEX IF NOT EXISTS idx_question_bank_pool ON question_bank(topic_key, language, qtype, status);

-- Index for reserved cleanup: find expired reservations
CREATE INDEX IF NOT EXISTS idx_question_bank_reserved ON question_bank(status, reserved_at);

-- Index for stats: count by status
CREATE INDEX IF NOT EXISTS idx_question_bank_status ON question_bank(status);

