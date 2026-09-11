CREATE TABLE public.owner_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.owner_emails TO service_role;
ALTER TABLE public.owner_emails ENABLE ROW LEVEL SECURITY;

INSERT INTO public.owner_emails (email) VALUES ('hetlarsultan2016@gmail.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_owner_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.owner_emails o WHERE lower(o.email) = v_email) THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_owner_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_owner_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_ads_stats()
RETURNS TABLE(
  total_count bigint,
  pending_count bigint,
  verified_count bigint,
  failed_count bigint,
  verification_rate numeric,
  user_share_total numeric,
  gross_total numeric,
  transferred_total numeric,
  available_total numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_pending bigint;
  v_verified bigint;
  v_failed bigint;
  v_user_share numeric;
  v_transferred numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE verification_status = 'pending' AND credit_status <> 'credited'),
         count(*) FILTER (WHERE verification_status = 'verified'),
         count(*) FILTER (WHERE verification_status IN ('failed','cancelled')),
         COALESCE(sum(reward_amount) FILTER (WHERE credit_status = 'credited'), 0)
    INTO v_total, v_pending, v_verified, v_failed, v_user_share
  FROM public.ad_reward_transactions;

  SELECT COALESCE(sum(amount), 0) INTO v_transferred FROM public.revenue_transfers;

  total_count := v_total;
  pending_count := v_pending;
  verified_count := v_verified;
  failed_count := v_failed;
  verification_rate := CASE WHEN v_total > 0 THEN round(v_verified::numeric * 100 / v_total, 2) ELSE 0 END;
  user_share_total := v_user_share;
  gross_total := v_user_share * 4;
  transferred_total := v_transferred;
  available_total := GREATEST((v_user_share * 4) - v_user_share - v_transferred, 0);
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.owner_ads_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.owner_ads_stats() TO authenticated;