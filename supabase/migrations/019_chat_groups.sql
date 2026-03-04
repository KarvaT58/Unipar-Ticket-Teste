-- Chat groups: groups, members (admin/member), messages, realtime

-- Groups table
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_groups_created_by ON public.chat_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_groups_last_message ON public.chat_groups(last_message_at DESC NULLS LAST);

-- Group members table (must exist before chat_groups RLS policies that reference it)
CREATE TABLE IF NOT EXISTS public.chat_group_members (
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_group_members_user ON public.chat_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_group ON public.chat_group_members(group_id);

ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

-- Users can view groups they are members of
CREATE POLICY "Members can view group"
  ON public.chat_groups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_group_members m
      WHERE m.group_id = id AND m.user_id = auth.uid()
    )
  );

-- Authenticated users can create a group (they become creator)
CREATE POLICY "Authenticated can create group"
  ON public.chat_groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only creator or admins can update group (e.g. name)
CREATE POLICY "Creator or admin can update group"
  ON public.chat_groups FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_group_members m
      WHERE m.group_id = id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_group_members m
      WHERE m.group_id = id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;

-- Members can view other members of their groups
CREATE POLICY "Members can view group members"
  ON public.chat_group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_group_members m2
      WHERE m2.group_id = chat_group_members.group_id AND m2.user_id = auth.uid()
    )
  );

-- Creator or admin can add members (creator when creating group; creator or admin when adding others)
CREATE POLICY "Creator or admin can add members"
  ON public.chat_group_members FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT created_by FROM public.chat_groups WHERE id = group_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_group_members m
      WHERE m.group_id = chat_group_members.group_id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

-- Creator or admin can remove members (except we don't allow removing the creator from chat_group_members - creator is always in group by app design)
CREATE POLICY "Creator or admin can remove members"
  ON public.chat_group_members FOR DELETE TO authenticated
  USING (
    (SELECT created_by FROM public.chat_groups WHERE id = group_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_group_members m
      WHERE m.group_id = chat_group_members.group_id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

-- Only creator can update role (grant admin)
CREATE POLICY "Creator can update member role"
  ON public.chat_group_members FOR UPDATE TO authenticated
  USING (
    (SELECT created_by FROM public.chat_groups WHERE id = group_id) = auth.uid()
  )
  WITH CHECK (
    (SELECT created_by FROM public.chat_groups WHERE id = group_id) = auth.uid()
  );

-- Group messages (same shape as chat_messages for reuse)
CREATE TABLE IF NOT EXISTS public.chat_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'voice', 'document')),
  file_path TEXT,
  file_name TEXT,
  is_priority BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_group_messages_group ON public.chat_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_messages_created ON public.chat_group_messages(group_id, created_at);

ALTER TABLE public.chat_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group messages"
  ON public.chat_group_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_group_members m
      WHERE m.group_id = chat_group_messages.group_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert group messages"
  ON public.chat_group_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_group_members m
      WHERE m.group_id = chat_group_messages.group_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Sender can delete own group message"
  ON public.chat_group_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- Trigger: update last_message_at on chat_groups when inserting message
CREATE OR REPLACE FUNCTION public.update_chat_group_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_groups
  SET last_message_at = NEW.created_at
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS chat_group_messages_update_last ON public.chat_group_messages;
CREATE TRIGGER chat_group_messages_update_last
  AFTER INSERT ON public.chat_group_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_group_last_message();

-- Realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_messages;
