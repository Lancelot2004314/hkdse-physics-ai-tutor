-- Migration: Add Vertex AI RAG Engine fields to kb_documents
-- Adds gcs_uri and ingest_job_id for tracking Vertex RAG import

-- Add gcs_uri column for Google Cloud Storage path
ALTER TABLE kb_documents ADD COLUMN gcs_uri TEXT;

-- Add ingest_job_id column for tracking Vertex RAG Engine import operation
ALTER TABLE kb_documents ADD COLUMN ingest_job_id TEXT;

-- Add rag_file_name column for Vertex RAG file resource name
ALTER TABLE kb_documents ADD COLUMN rag_file_name TEXT;

-- Create index for gcs_uri lookups
CREATE INDEX IF NOT EXISTS idx_kb_documents_gcs_uri ON kb_documents(gcs_uri);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON kb_documents(status);
