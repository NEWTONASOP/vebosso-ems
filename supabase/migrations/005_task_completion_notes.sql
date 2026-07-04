-- ============================================================================
-- Migration: 005_task_completion_notes.sql
-- Adds completion_note and completed_at columns to tasks table
-- ============================================================================

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS completion_note TEXT;

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add index for faster filtering by completed_at
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);
