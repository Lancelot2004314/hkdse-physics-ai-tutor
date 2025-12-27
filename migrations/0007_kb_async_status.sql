-- Add async processing fields to kb_documents
-- Note: status column may already exist from previous migration

-- Add r2_key for file storage reference
ALTER TABLE kb_documents ADD COLUMN r2_key TEXT;

-- Add error_message for failed processing
ALTER TABLE kb_documents ADD COLUMN error_message TEXT;

-- Add processed_at timestamp
ALTER TABLE kb_documents ADD COLUMN processed_at DATETIME;

