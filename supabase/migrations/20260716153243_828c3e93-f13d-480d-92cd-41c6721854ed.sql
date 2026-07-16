CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete private messages older than 48 hours
  DELETE FROM public.private_messages WHERE created_at < now() - interval '48 hours';

  -- Delete any account (guest or member) inactive for 2 months
  DELETE FROM auth.users WHERE id IN (
    SELECT id FROM public.profiles
    WHERE last_seen < now() - interval '2 months'
  );
END;
$$;