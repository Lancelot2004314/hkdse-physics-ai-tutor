-- Cleanup Orphan Edges
-- Remove edges that reference non-existent nodes
-- Run with: wrangler d1 execute hkdse-physics-tutor-db --remote --file=./migrations/0018_cleanup_orphan_edges.sql

-- Delete edges where source node doesn't exist
DELETE FROM kg_edges 
WHERE source_id NOT IN (SELECT id FROM kg_nodes);

-- Delete edges where target node doesn't exist
DELETE FROM kg_edges 
WHERE target_id NOT IN (SELECT id FROM kg_nodes);







