-- Notifications table for atendimentos (persistent until read)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  ticket_message_id UUID REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'new_message',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_at ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON public.notifications(ticket_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger: on new ticket_message, notify the other party (not the sender)
CREATE OR REPLACE FUNCTION public.notify_ticket_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
BEGIN
  SELECT created_by, assigned_to_user_id INTO t FROM public.tickets WHERE id = NEW.ticket_id;
  IF NEW.user_id = t.created_by AND t.assigned_to_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, ticket_id, ticket_message_id, type)
    VALUES (t.assigned_to_user_id, NEW.ticket_id, NEW.id, 'new_message');
  ELSIF NEW.user_id = t.assigned_to_user_id THEN
    INSERT INTO public.notifications (user_id, ticket_id, ticket_message_id, type)
    VALUES (t.created_by, NEW.ticket_id, NEW.id, 'new_message');
  ELSIF NEW.user_id != t.created_by AND (t.assigned_to_user_id IS NULL OR t.assigned_to_user_id != NEW.user_id) THEN
    INSERT INTO public.notifications (user_id, ticket_id, ticket_message_id, type)
    VALUES (t.created_by, NEW.ticket_id, NEW.id, 'new_message');
    IF t.assigned_to_user_id IS NOT NULL AND t.assigned_to_user_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, ticket_id, ticket_message_id, type)
      VALUES (t.assigned_to_user_id, NEW.ticket_id, NEW.id, 'new_message');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ticket_message_notify ON public.ticket_messages;
CREATE TRIGGER on_ticket_message_notify
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ticket_message();

-- Enable Realtime for notifications (run manually if using local migrations)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
