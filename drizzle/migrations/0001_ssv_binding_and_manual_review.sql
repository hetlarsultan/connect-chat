ALTER TABLE public.ad_reward_transactions
  ADD COLUMN IF NOT EXISTS network_transaction_id text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS manual_action text,
  ADD COLUMN IF NOT EXISTS manual_by uuid,
  ADD COLUMN IF NOT EXISTS manual_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_note text;

CREATE UNIQUE INDEX IF NOT EXISTS ad_reward_transactions_network_txn_uidx
  ON public.ad_reward_transactions (network_transaction_id)
  WHERE network_transaction_id IS NOT NULL;

-- Owner manual approval: credits the wallet of the user who started the view (from ad_view_requests).
CREATE OR REPLACE FUNCTION public.owner_manual_credit(_owner_id uuid, _transaction_id text, _gross_value numeric, _note text DEFAULT NULL)
RETURNS TABLE(credited boolean, reward numeric, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
  _reward numeric(12,4);
  _row public.ad_reward_transactions;
BEGIN
  IF _owner_id IS NULL OR NOT public.has_role(_owner_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT user_id INTO _uid FROM public.ad_view_requests WHERE transaction_id = _transaction_id;
  IF _uid IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, 'no_view_request'::text;
    RETURN;
  END IF;

  _reward := round(GREATEST(LEAST(coalesce(_gross_value, 0), 1), 0) * 0.25, 4);

  INSERT INTO public.ad_reward_transactions
    (user_id, transaction_id, ad_network, reward_amount, verification_status, credit_status)
  VALUES (_uid, _transaction_id, 'admob', 0, 'pending', 'pending')
  ON CONFLICT (transaction_id) DO NOTHING;

  SELECT * INTO _row FROM public.ad_reward_transactions WHERE transaction_id = _transaction_id FOR UPDATE;

  IF _row.user_id <> _uid THEN
    RETURN QUERY SELECT false, 0::numeric, 'user_mismatch'::text;
    RETURN;
  END IF;
  IF _row.credit_status = 'credited' THEN
    RETURN QUERY SELECT false, 0::numeric, 'already_credited'::text;
    RETURN;
  END IF;

  UPDATE public.ad_reward_transactions
  SET reward_amount = _reward,
      verification_status = 'verified',
      credit_status = 'credited',
      failure_reason = NULL,
      notified_at = NULL,
      manual_action = 'approved',
      manual_by = _owner_id,
      manual_at = now(),
      manual_note = left(_note, 500)
  WHERE id = _row.id;

  INSERT INTO public.wallets (user_id, balance) VALUES (_uid, _reward)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + _reward, updated_at = now();

  RETURN QUERY SELECT true, _reward, 'ok'::text;
END $$;

-- Owner manual rejection: marks a non-credited transaction as failed (never touches credited ones).
CREATE OR REPLACE FUNCTION public.owner_manual_reject(_owner_id uuid, _transaction_id text, _note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
  _row public.ad_reward_transactions;
BEGIN
  IF _owner_id IS NULL OR NOT public.has_role(_owner_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT user_id INTO _uid FROM public.ad_view_requests WHERE transaction_id = _transaction_id;
  IF _uid IS NULL THEN
    RETURN 'no_view_request';
  END IF;

  INSERT INTO public.ad_reward_transactions
    (user_id, transaction_id, ad_network, reward_amount, verification_status, credit_status)
  VALUES (_uid, _transaction_id, 'admob', 0, 'failed', 'not_credited')
  ON CONFLICT (transaction_id) DO NOTHING;

  SELECT * INTO _row FROM public.ad_reward_transactions WHERE transaction_id = _transaction_id FOR UPDATE;
  IF _row.credit_status = 'credited' THEN
    RETURN 'already_credited';
  END IF;

  UPDATE public.ad_reward_transactions
  SET verification_status = 'failed',
      credit_status = 'not_credited',
      reward_amount = 0,
      failure_reason = coalesce(failure_reason, 'manual_reject'),
      notified_at = NULL,
      manual_action = 'rejected',
      manual_by = _owner_id,
      manual_at = now(),
      manual_note = left(_note, 500)
  WHERE id = _row.id;

  RETURN 'ok';
END $$;

REVOKE EXECUTE ON FUNCTION public.owner_manual_credit(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_manual_reject(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_manual_credit(uuid, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_manual_reject(uuid, text, text) TO service_role;