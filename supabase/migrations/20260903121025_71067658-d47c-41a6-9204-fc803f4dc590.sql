REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.my_reward_totals() FROM anon;
REVOKE ALL ON FUNCTION public.owner_reward_overview() FROM anon;
REVOKE ALL ON FUNCTION public.record_revenue_transfer(numeric, numeric, text) FROM anon;