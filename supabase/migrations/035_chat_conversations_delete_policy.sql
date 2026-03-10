-- Allow participants to delete their own conversation (removes conversation and all messages via CASCADE)
CREATE POLICY "Users can delete own conversations"
  ON public.chat_conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
