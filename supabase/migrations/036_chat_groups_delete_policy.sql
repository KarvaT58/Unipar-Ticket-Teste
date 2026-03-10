-- Allow creator or admin to delete the group.
-- CASCADE on chat_group_members and chat_group_messages will remove members and messages automatically.

CREATE POLICY "Creator or admin can delete group"
  ON public.chat_groups FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.current_user_is_creator_or_admin_of_chat_group(id)
  );
