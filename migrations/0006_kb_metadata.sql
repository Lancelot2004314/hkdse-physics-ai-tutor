-- Migration: Add language, subject, doc_type to kb_documents
-- These fields allow better organization and filtering of knowledge base content

-- Add new columns to kb_documents
ALTER TABLE kb_documents ADD COLUMN language TEXT DEFAULT 'en';
ALTER TABLE kb_documents ADD COLUMN subject TEXT DEFAULT 'Physics';
ALTER TABLE kb_documents ADD COLUMN doc_type TEXT DEFAULT 'Past Paper';

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_kb_documents_language ON kb_documents(language);
CREATE INDEX IF NOT EXISTS idx_kb_documents_subject ON kb_documents(subject);
CREATE INDEX IF NOT EXISTS idx_kb_documents_doc_type ON kb_documents(doc_type);

