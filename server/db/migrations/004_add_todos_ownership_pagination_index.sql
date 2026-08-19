CREATE INDEX idx_todos_created_by_created_at_id
ON todos (created_by, created_at DESC, id DESC);
