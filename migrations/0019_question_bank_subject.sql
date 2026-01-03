-- Add subject column to question_bank table
-- This allows filtering questions by Physics or Mathematics

ALTER TABLE question_bank ADD COLUMN subject TEXT DEFAULT 'Physics';

-- Create index for efficient filtering by subject
CREATE INDEX IF NOT EXISTS idx_question_bank_subject ON question_bank(subject, topic_key, language, qtype, status);

