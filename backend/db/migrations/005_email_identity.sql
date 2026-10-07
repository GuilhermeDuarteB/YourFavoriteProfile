-- Retain users_email_key as well.
CREATE UNIQUE INDEX users_email_normalized_unique ON public.users (LOWER(TRIM(email)));
