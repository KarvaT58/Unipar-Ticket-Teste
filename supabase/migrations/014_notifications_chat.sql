-- Extend notifications for internal chat: one notification per new message (for recipient)

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS chat_conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS chat_sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Allow exactly one of ticket_id, announcement_id, or chat_conversation_id
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_entity_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_entity_check CHECK (
    (ticket_id IS NOT NULL AND announcement_id IS NULL AND chat_conversation_id IS NULL)
    OR (ticket_id IS NULL AND announcement_id IS NOT NULL AND chat_conversation_id IS NULL)
    OR (ticket_id IS NULL AND announcement_id IS NULL AND chat_conversation_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_notifications_chat_conversation_id ON public.notifications(chat_conversation_id);

-- Trigger: on new chat_message, notify the other participant
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  recipient_id UUID;
BEGIN
  SELECT user_a_id, user_b_id INTO rec
  FROM public.chat_conversations
  WHERE id = NEW.conversation_id;

  IF rec.user_a_id = NEW.sender_id THEN
    recipient_id := rec.user_b_id;
  ELSE
    recipient_id := rec.user_a_id;
  END IF;

  INSERT INTO public.notifications (user_id, chat_conversation_id, chat_sender_id, type)
  VALUES (recipient_id, NEW.conversation_id, NEW.sender_id, 'chat_message');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_chat_message_notify ON public.chat_messages;
CREATE TRIGGER on_chat_message_notify
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();
