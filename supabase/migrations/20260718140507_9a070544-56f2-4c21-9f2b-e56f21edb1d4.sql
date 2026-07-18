
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.cleanup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  deleted_count integer NOT NULL DEFAULT 0,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cleanup_logs TO service_role;

ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY;

-- No policies granted to anon/authenticated: only service_role (used by SECURITY DEFINER cleanup fn) can read/write.

CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pm_deleted integer := 0;
  users_deleted integer := 0;
BEGIN
  -- Delete private messages older than 48 hours
  WITH d AS (
    DELETE FROM public.private_messages
    WHERE created_at < now() - interval '48 hours'
    RETURNING 1
  )
  SELECT count(*) INTO pm_deleted FROM d;

  INSERT INTO public.cleanup_logs (task, deleted_count)
  VALUES ('private_messages_48h', pm_deleted);

  -- Delete accounts (guest or member) inactive for 60 days
  WITH d AS (
    DELETE FROM auth.users
    WHERE id IN (
      SELECT id FROM public.profiles
      WHERE last_seen < now() - interval '60 days'
    )
    RETURNING 1
  )
  SELECT count(*) INTO users_deleted FROM d;

  INSERT INTO public.cleanup_logs (task, deleted_count)
  VALUES ('inactive_accounts_60d', users_deleted);
END;
$$;

-- Unschedule prior job if any, then schedule daily at 00:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-data-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-data-daily',
  '0 0 * * *',
  $$ SELECT public.cleanup_expired_data(); $$
);
