-- Allow edit and soft-delete of ticket messages; show "Mensagem apagada" / "editada" in the UI

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ticket_messages.deleted_at IS 'When set, message is shown as "Mensagem apagada" to both parties.';
COMMENT ON COLUMN public.ticket_messages.edited_at IS 'When set, message content was edited; UI shows "editada" on the bubble.';

-- Allow authors to update their own messages (for edit/delete only)
CREATE POLICY "Users can update own ticket messages"
  ON public.ticket_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
