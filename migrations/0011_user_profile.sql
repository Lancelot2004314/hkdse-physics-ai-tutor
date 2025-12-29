-- User Profile Enhancement Migration
-- Adds profile fields to users table for storing user preferences and avatar

-- Add name field for display name
ALTER TABLE users ADD COLUMN name TEXT;

-- Add language preference (en, zh-HK, zh-CN)
ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en';

-- Add user role (student, teacher, parent, other)
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student';

-- Add avatar URL (stored in R2)
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Add updated_at timestamp
ALTER TABLE users ADD COLUMN updated_at TEXT;
