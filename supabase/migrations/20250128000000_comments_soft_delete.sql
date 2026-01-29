-- Soft delete for comments: add deleted_at column
-- Run this in Supabase SQL Editor if the column does not exist.

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.comments.deleted_at IS 'When set, comment is soft-deleted and content is hidden; can be restored later.';
