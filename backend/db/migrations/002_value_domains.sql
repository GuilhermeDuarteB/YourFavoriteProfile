ALTER TABLE public.media
  ADD CONSTRAINT media_type_check CHECK (type IN ('movie', 'series', 'game')),
  ADD CONSTRAINT media_source_check CHECK (source IN ('tmdb', 'rawg')),
  ADD CONSTRAINT media_source_type_check CHECK (
    (source = 'tmdb' AND type IN ('movie', 'series')) OR
    (source = 'rawg' AND type = 'game')
  ),
  ADD CONSTRAINT media_external_id_nonblank_check CHECK (BTRIM(external_id) <> '');

ALTER TABLE public.watchlist
  ADD CONSTRAINT watchlist_status_check
  CHECK (status IN ('want_to_watch', 'watching', 'completed', 'dropped'));
