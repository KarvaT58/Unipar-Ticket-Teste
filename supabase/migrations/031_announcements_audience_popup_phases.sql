-- Audience targeting and popup phase tracking for announcements

-- 1) Add audience_type to announcements (default 'all' for existing rows)
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS audience_type TEXT NOT NULL DEFAULT 'all'
  CHECK (audience_type IN ('all', 'specific_users'));

-- 2) Pivot table: which users are targeted when audience_type = 'specific_users'
CREATE TABLE IF NOT EXISTS public.announcement_audience_users (
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_audience_users_user_id
  ON public.announcement_audience_users(user_id);

ALTER TABLE public.announcement_audience_users ENABLE ROW LEVEL SECURITY;

-- Users can see rows for announcements they own or where they are the target user
CREATE POLICY "Users can view audience rows for visible announcements"
  ON public.announcement_audience_users FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.created_by = auth.uid()
    )
  );

-- Only announcement owner can insert/update/delete audience users
CREATE POLICY "Announcement owner can manage audience users"
  ON public.announcement_audience_users FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.created_by = auth.uid()
    )
  );

-- 3) Popup views by phase: one row per (announcement, user, phase) when user has seen the popup
CREATE TABLE IF NOT EXISTS public.announcement_popup_views (
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('publish', 'event_day')),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_date_ref DATE,
  PRIMARY KEY (announcement_id, user_id, phase)
);

CREATE INDEX IF NOT EXISTS idx_announcement_popup_views_user_id
  ON public.announcement_popup_views(user_id);

ALTER TABLE public.announcement_popup_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own popup views"
  ON public.announcement_popup_views FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own popup views"
  ON public.announcement_popup_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own popup views"
  ON public.announcement_popup_views FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4) Update announcements SELECT policy: user sees announcement if audience is 'all' or user is in audience
DROP POLICY IF EXISTS "Authenticated can view announcements" ON public.announcements;

CREATE POLICY "Authenticated can view announcements by audience"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    audience_type = 'all'
    OR EXISTS (
      SELECT 1 FROM public.announcement_audience_users au
      WHERE au.announcement_id = id AND au.user_id = auth.uid()
    )
  );
