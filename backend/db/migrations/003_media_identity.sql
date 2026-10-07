-- Establish the replacement before removing the historical protection.
ALTER TABLE public.media
  ADD CONSTRAINT media_external_id_source_type_key UNIQUE (external_id, source, type);
ALTER TABLE public.media DROP CONSTRAINT media_external_id_source_key;
