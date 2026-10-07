ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_positive_score_check CHECK (score > 0 AND score <= 10);
ALTER TABLE public.reviews DROP CONSTRAINT reviews_score_check;
