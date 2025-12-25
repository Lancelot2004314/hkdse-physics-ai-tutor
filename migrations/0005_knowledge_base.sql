-- Knowledge Base tables for RAG system
-- Stores DSE past papers and learning materials

-- Documents table (metadata for uploaded documents)
CREATE TABLE IF NOT EXISTS kb_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  filename TEXT,
  year INTEGER,
  paper TEXT,  -- 'Paper 1A', 'Paper 1B', 'Paper 2', etc.
  source TEXT, -- 'DSE', 'Mock', 'Textbook', 'Notes'
  chunk_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing', -- 'processing', 'ready', 'error'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chunks table (individual pieces of content with embeddings)
CREATE TABLE IF NOT EXISTS kb_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES kb_documents(id) ON DELETE CASCADE,
  question_number TEXT,  -- e.g., 'Q1', 'Q2a', 'MC1-10'
  topic TEXT,            -- e.g., 'mechanics', 'electricity'
  content_type TEXT,     -- 'question', 'answer', 'marking_scheme', 'explanation'
  content TEXT NOT NULL,
  embedding_id TEXT,     -- ID in Vectorize
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document ON kb_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_topic ON kb_chunks(topic);
CREATE INDEX IF NOT EXISTS idx_kb_documents_year ON kb_documents(year);
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON kb_documents(status);


