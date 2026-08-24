-- Wallets
CREATE TABLE public.wallets (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(12,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallets_select_own ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Ad view requests (created before the ad plays, links transaction_id to a user)
CREATE TABLE public.ad_view_requests (
  transaction_id text NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ad_view_requests TO authenticated;
GRANT ALL ON public.ad_view_requests TO service_role;
ALTER TABLE public.ad_view_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_view_requests_insert_own ON public.ad_view_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ad_view_requests_select_own ON public.ad_view_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Reward ledger
CREATE TABLE public.ad_reward_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id text NOT NULL UNIQUE,
  ad_network text NOT NULL DEFAULT 'admob',
  reward_amount numeric(12,4) NOT NULL DEFAULT 0,
  verification_status text NOT NULL DEFAULT 'pending',
  credit_status text NOT NULL DEFAULT 'pending',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.ad_reward_transactions TO authenticated;
GRANT ALL ON public.ad_reward_transactions TO service_role;
ALTER TABLE public.ad_reward_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_rewards_select_own ON public.ad_reward_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ad_rewards_update_own_notified ON public.ad_reward_transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ad_rewards_user_created_idx ON public.ad_reward_transactions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER ad_rewards_touch BEFORE UPDATE ON public.ad_reward_transactions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER wallets_touch BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Credit a verified reward atomically; idempotent per transaction_id.
CREATE OR REPLACE FUNCTION public.credit_ad_reward(
  _user_id uuid,
  _transaction_id text,
  _gross_value numeric,
  _ad_network text DEFAULT 'admob'
) RETURNS TABLE (credited boolean, reward numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _reward numeric(12,4);
  _inserted boolean := false;
BEGIN
  _reward := round(coalesce(_gross_value, 0) * 0.25, 4);

  INSERT INTO public.ad_reward_transactions
    (user_id, transaction_id, ad_network, reward_amount, verification_status, credit_status, occurred_at)
  VALUES (_user_id, _transaction_id, _ad_network, _reward, 'verified', 'pending', now())
  ON CONFLICT (transaction_id) DO NOTHING;

  SELECT true INTO _inserted
  FROM public.ad_reward_transactions
  WHERE transaction_id = _transaction_id AND credit_status = 'pending' AND verification_status = 'verified';

  IF NOT coalesce(_inserted, false) THEN
    RETURN QUERY SELECT false, 0::numeric;
    RETURN;
  END IF;

  INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, _reward)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + _reward, updated_at = now();

  UPDATE public.ad_reward_transactions
  SET credit_status = 'credited'
  WHERE transaction_id = _transaction_id;

  RETURN QUERY SELECT true, _reward;
END; $$;

REVOKE ALL ON FUNCTION public.credit_ad_reward(uuid, text, numeric, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_ad_reward(uuid, text, numeric, text) TO service_role;

-- Record a failed verification without crediting anything
CREATE OR REPLACE FUNCTION public.record_failed_ad_reward(_user_id uuid, _transaction_id text, _ad_network text DEFAULT 'admob')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ad_reward_transactions
    (user_id, transaction_id, ad_network, reward_amount, verification_status, credit_status)
  VALUES (_user_id, _transaction_id, _ad_network, 0, 'failed', 'not_credited')
  ON CONFLICT (transaction_id) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.record_failed_ad_reward(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_ad_reward(uuid, text, text) TO service_role;