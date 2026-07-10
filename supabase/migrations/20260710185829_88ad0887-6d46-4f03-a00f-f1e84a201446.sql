
-- Enable realtime for badges
ALTER TABLE public.private_messages REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Retention cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete private messages older than 48 hours
  DELETE FROM public.private_messages WHERE created_at < now() - interval '48 hours';

  -- Delete guest profiles inactive for 2 days
  DELETE FROM auth.users WHERE id IN (
    SELECT id FROM public.profiles
    WHERE is_guest = true AND last_seen < now() - interval '2 days'
  );

  -- Delete member profiles inactive for 2 months
  DELETE FROM auth.users WHERE id IN (
    SELECT id FROM public.profiles
    WHERE is_guest = false AND last_seen < now() - interval '2 months'
  );
END;
$$;

-- Schedule via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('cleanup_expired_data_hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'cleanup_expired_data_hourly',
  '0 * * * *',
  $$ SELECT public.cleanup_expired_data(); $$
);
