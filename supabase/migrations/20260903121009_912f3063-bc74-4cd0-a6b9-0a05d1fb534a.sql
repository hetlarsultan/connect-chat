DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE IF NOT EXISTS public.revenue_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount > 0),
  network_pct numeric NOT NULL DEFAULT 0 CHECK (network_pct >= 0 AND network_pct <= 100),
  network_amount numeric NOT NULL DEFAULT 0,
  owner_amount numeric NOT NULL DEFAULT 0,
  note text,
  status text NOT NULL DEFAULT 'recorded',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.revenue_transfers TO authenticated;
GRANT ALL ON public.revenue_transfers TO service_role;
ALTER TABLE public.revenue_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS revenue_transfers_select_admin ON public.revenue_transfers;
CREATE POLICY revenue_transfers_select_admin ON public.revenue_transfers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.my_reward_totals()
RETURNS TABLE (
  credited_count bigint,
  pending_count bigint,
  failed_count bigint,
  total_earned numeric,
  wallet_balance numeric,
  first_at timestamptz,
  last_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    count(*) FILTER (WHERE t.credit_status = 'credited'),
    count(*) FILTER (WHERE t.credit_status <> 'credited' AND t.verification_status = 'pending'),
    count(*) FILTER (WHERE t.verification_status IN ('failed','cancelled')),
    COALESCE(sum(t.reward_amount) FILTER (WHERE t.credit_status = 'credited'), 0),
    COALESCE((SELECT w.balance FROM public.wallets w WHERE w.user_id = auth.uid()), 0),
    min(t.occurred_at),
    max(t.occurred_at)
  FROM public.ad_reward_transactions t
  WHERE t.user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.my_reward_totals() FROM public;
GRANT EXECUTE ON FUNCTION public.my_reward_totals() TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_reward_overview()
RETURNS TABLE (
  credited_count bigint,
  users_count bigint,
  user_share_total numeric,
  gross_total numeric,
  transferred_total numeric,
  available_total numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_share numeric;
  v_gross numeric;
  v_transferred numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(sum(reward_amount), 0), count(*), count(DISTINCT user_id)
    INTO v_user_share, credited_count, users_count
  FROM public.ad_reward_transactions
  WHERE credit_status = 'credited';

  v_gross := v_user_share * 4; -- user share is 25% of the approved gross value
  SELECT COALESCE(sum(amount), 0) INTO v_transferred FROM public.revenue_transfers;

  user_share_total := v_user_share;
  gross_total := v_gross;
  transferred_total := v_transferred;
  available_total := GREATEST(v_gross - v_user_share - v_transferred, 0);
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.owner_reward_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.owner_reward_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.record_revenue_transfer(
  _amount numeric,
  _network_pct numeric,
  _note text DEFAULT NULL
)
RETURNS public.revenue_transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.revenue_transfers;
  v_available numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _network_pct IS NULL OR _network_pct < 0 OR _network_pct > 100 THEN
    RAISE EXCEPTION 'invalid percentage';
  END IF;

  SELECT available_total INTO v_available FROM public.owner_reward_overview();
  IF _amount > v_available THEN
    RAISE EXCEPTION 'amount exceeds available balance';
  END IF;

  INSERT INTO public.revenue_transfers (amount, network_pct, network_amount, owner_amount, note, created_by)
  VALUES (
    _amount,
    _network_pct,
    round(_amount * _network_pct / 100.0, 6),
    round(_amount - (_amount * _network_pct / 100.0), 6),
    NULLIF(btrim(_note), ''),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.record_revenue_transfer(numeric, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_revenue_transfer(numeric, numeric, text) TO authenticated;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users ORDER BY created_at ASC LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;