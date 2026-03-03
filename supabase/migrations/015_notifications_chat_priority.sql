-- Add chat_message_id to notifications and use type chat_priority_message for priority chat messages

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS chat_message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_chat_message_id ON public.notifications(chat_message_id);

-- Update trigger: set type to chat_priority_message when is_priority, and set chat_message_id
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  recipient_id UUID;
  notif_type TEXT;
BEGIN
  SELECT user_a_id, user_b_id INTO rec
  FROM public.chat_conversations
  WHERE id = NEW.conversation_id;

  IF rec.user_a_id = NEW.sender_id THEN
    recipient_id := rec.user_b_id;
  ELSE
    recipient_id := rec.user_a_id;
  END IF;

  notif_type := CASE WHEN NEW.is_priority THEN 'chat_priority_message' ELSE 'chat_message' END;

  INSERT INTO public.notifications (user_id, chat_conversation_id, chat_sender_id, chat_message_id, type)
  VALUES (recipient_id, NEW.conversation_id, NEW.sender_id, NEW.id, notif_type);

  RETURN NEW;
END;
$$;
