-- ============================================================================
-- VEBOSSO EMS — PDF & Word documents (022)
-- ============================================================================
-- The `documents` bucket (020) accepted images and PDF. Add Word files and
-- raise the size limit a little for scanned PDFs. Run after 020.
-- Safe to run repeatedly.
-- ============================================================================

UPDATE storage.buckets
SET
  file_size_limit = 20971520, -- 20MB
  allowed_mime_types = '{
    "image/jpeg", "image/png", "image/webp", "image/heic",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }'
WHERE id = 'documents';
