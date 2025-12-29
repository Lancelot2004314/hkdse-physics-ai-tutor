-- Text Questions Database
-- Stores text-only questions and their AI answers for admin review
-- Run with: wrangler d1 execute hkdse-physics-tutor-db --file=./migrations/0008_text_questions.sql

CREATE TABLE IF NOT EXISTS text_questions (
    id TEXT PRIMARY KEY,
    question_text TEXT NOT NULL,
    ai_answer TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_text_questions_created ON text_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_text_questions_search ON text_questions(question_text);

