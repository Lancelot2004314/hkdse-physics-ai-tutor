-- Email + Password login support
-- Run with: wrangler d1 execute hkdse-physics-tutor-db --file=./migrations/0013_email_password_login.sql

-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Note: Users can login via:
-- 1. Google OAuth (no password needed)
-- 2. Email + Password (password_hash required)
-- 3. Phone + SMS (if configured later)







