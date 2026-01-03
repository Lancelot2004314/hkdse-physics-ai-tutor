-- Add grading_results column to quiz_sessions table
-- This stores the detailed grading results for each question (score, feedback, isCorrect)

ALTER TABLE quiz_sessions ADD COLUMN grading_results TEXT;

