-- Preserve display casing and the existing users_username_key constraint.
CREATE UNIQUE INDEX users_username_lower_unique ON public.users (LOWER(username));
