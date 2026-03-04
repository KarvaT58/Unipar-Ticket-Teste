-- Fix infinite recursion in chat_group_members RLS (policies must not SELECT from same table).
-- Use SECURITY DEFINER functions so the check bypasses RLS.

CREATE OR REPLACE FUNCTION public.current_user_is_member_of_chat_group(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.group_id = gid AND cgm.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Members can view group members" ON public.chat_group_members;
CREATE POLICY "Members can view group members"
  ON public.chat_group_members FOR SELECT TO authenticated
  USING (public.current_user_is_member_of_chat_group(group_id));

CREATE OR REPLACE FUNCTION public.current_user_is_creator_or_admin_of_chat_group(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    (SELECT created_by FROM public.chat_groups WHERE id = gid) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_group_members cgm
      WHERE cgm.group_id = gid AND cgm.user_id = auth.uid() AND cgm.role = 'admin'
    )
  );
$$;

DROP POLICY IF EXISTS "Creator or admin can add members" ON public.chat_group_members;
CREATE POLICY "Creator or admin can add members"
  ON public.chat_group_members FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_creator_or_admin_of_chat_group(group_id));

DROP POLICY IF EXISTS "Creator or admin can remove members" ON public.chat_group_members;
CREATE POLICY "Creator or admin can remove members"
  ON public.chat_group_members FOR DELETE TO authenticated
  USING (public.current_user_is_creator_or_admin_of_chat_group(group_id));

DROP POLICY IF EXISTS "Creator can update member role" ON public.chat_group_members;
CREATE POLICY "Creator can update member role"
  ON public.chat_group_members FOR UPDATE TO authenticated
  USING ((SELECT created_by FROM public.chat_groups WHERE id = group_id) = auth.uid())
  WITH CHECK ((SELECT created_by FROM public.chat_groups WHERE id = group_id) = auth.uid());

-- Allow creator to see group before being in chat_group_members (so INSERT ... RETURNING works)
DROP POLICY IF EXISTS "Members can view group" ON public.chat_groups;
CREATE POLICY "Members can view group"
  ON public.chat_groups FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.current_user_is_member_of_chat_group(id)
  );
