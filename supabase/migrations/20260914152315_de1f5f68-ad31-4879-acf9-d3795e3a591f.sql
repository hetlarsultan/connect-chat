CREATE TABLE public.ad_settings (
  id boolean NOT NULL DEFAULT true PRIMARY KEY,
  rewarded_ad_unit_id text,
  ads_enabled boolean NOT NULL DEFAULT true,
  rewarded_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_settings_singleton CHECK (id)
);

GRANT SELECT ON public.ad_settings TO authenticated;
GRANT INSERT, UPDATE ON public.ad_settings TO authenticated;
GRANT ALL ON public.ad_settings TO service_role;

ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_settings_select_authenticated ON public.ad_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY ad_settings_insert_admin ON public.ad_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY ad_settings_update_admin ON public.ad_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ad_settings_touch BEFORE UPDATE ON public.ad_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.ad_settings (id, rewarded_ad_unit_id, ads_enabled, rewarded_enabled)
VALUES (true, NULL, true, true);

CREATE TABLE public.ad_error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ad_unit_id text,
  stage text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ad_error_logs TO authenticated;
GRANT ALL ON public.ad_error_logs TO service_role;

ALTER TABLE public.ad_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_error_logs_insert_own ON public.ad_error_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY ad_error_logs_select_own_or_admin ON public.ad_error_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));