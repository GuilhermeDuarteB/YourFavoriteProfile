CREATE UNIQUE INDEX reviews_user_media_unique
  ON public.reviews (user_id, media_id) WHERE media_id IS NOT NULL;
CREATE UNIQUE INDEX reviews_user_episode_unique
  ON public.reviews (user_id, episode_id) WHERE episode_id IS NOT NULL;
