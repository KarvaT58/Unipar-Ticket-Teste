-- Add edited_at and deleted_at to chat_messages and chat_group_messages
-- edited_at: set when content is updated; deleted_at: soft delete (show "Mensagem apagada")

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.chat_group_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Sender can update own message (edit content + edited_at, or soft delete + deleted_at)
CREATE POLICY "Users can update own chat messages"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Sender can update own group message"
  ON public.chat_group_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
