-- ============================================================================
-- VEBOSSO EMS — Notifications on the web (057)
-- ============================================================================
-- Each browser that turns notifications on saves its push subscription here;
-- the edge functions send to these alongside the phone (Expo) token. One
-- person can have several browsers. A browser belongs to whoever signed in
-- on it last, so a shared computer never gets someone else's notifications.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_web_push_endpoint CHECK (endpoint ~ '^https://' AND length(endpoint) <= 1000),
  CONSTRAINT chk_web_push_keys CHECK (length(p256dh) <= 200 AND length(auth) <= 100)
);

CREATE INDEX IF NOT EXISTS idx_web_push_user ON public.web_push_subscriptions(user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- People see their own browsers; writes go through the functions below.
DROP POLICY IF EXISTS "web_push_read_own" ON public.web_push_subscriptions;
CREATE POLICY "web_push_read_own" ON public.web_push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.save_web_push(p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS VOID AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = auth.uid(),
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        last_seen_at = now();
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Signing out, or turning it off: this browser stops getting them.
CREATE OR REPLACE FUNCTION public.remove_web_push(p_endpoint TEXT)
RETURNS VOID AS $fn$
  DELETE FROM public.web_push_subscriptions WHERE endpoint = p_endpoint AND user_id = auth.uid();
$fn$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.save_web_push(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_web_push(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_web_push(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_web_push(TEXT) TO authenticated;
