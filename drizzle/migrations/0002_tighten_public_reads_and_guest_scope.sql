-- 1) Profiles: readable by signed-in users only (no longer by unauthenticated visitors)
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_signed_in ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.profiles FROM anon;

-- Username availability check usable before sign-up without exposing profiles
CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE username = btrim(left(coalesce(_username, ''), 64))
  )
$$;
REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

-- 2) Room messages: readable by signed-in users only
DROP POLICY IF EXISTS messages_select_all ON public.messages;
CREATE POLICY messages_select_signed_in ON public.messages
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.messages FROM anon;

-- 3) Rooms: readable by signed-in users only
DROP POLICY IF EXISTS rooms_select_all ON public.rooms;
CREATE POLICY rooms_select_signed_in ON public.rooms
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.rooms FROM anon;

-- 4) Ad settings: full row readable by the owner only; others get just what the app needs
DROP POLICY IF EXISTS ad_settings_select_authenticated ON public.ad_settings;
CREATE POLICY ad_settings_select_admin ON public.ad_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_ad_config()
RETURNS TABLE(rewarded_ad_unit_id text, ads_enabled boolean, rewarded_enabled boolean, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.rewarded_ad_unit_id, s.ads_enabled, s.rewarded_enabled, s.updated_at
  FROM public.ad_settings s
  WHERE auth.uid() IS NOT NULL
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_ad_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ad_config() TO authenticated;

-- 5) Guest (anonymous) sessions are excluded from owner-only data
CREATE POLICY revenue_transfers_no_guests ON public.revenue_transfers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE)
  WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE);

CREATE POLICY ad_settings_no_guests ON public.ad_settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE)
  WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE);

-- Owner-wide reads on reward data require a non-guest session
DROP POLICY IF EXISTS ad_rewards_select_admin ON public.ad_reward_transactions;
CREATE POLICY ad_rewards_select_admin ON public.ad_reward_transactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE);

DROP POLICY IF EXISTS ad_view_requests_select_admin ON public.ad_view_requests;
CREATE POLICY ad_view_requests_select_admin ON public.ad_view_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE);

DROP POLICY IF EXISTS ad_error_logs_select_own_or_admin ON public.ad_error_logs;
CREATE POLICY ad_error_logs_select_own_or_admin ON public.ad_error_logs
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (public.has_role(auth.uid(), 'admin') AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE)
  );

-- 6) Avatars: each user can only list/read their own files directly.
-- Avatars shown in the app use long-lived signed links, which keep working.
DROP POLICY IF EXISTS avatars_read_all ON storage.objects;
CREATE POLICY avatars_read_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);