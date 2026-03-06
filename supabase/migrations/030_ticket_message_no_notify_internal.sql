-- Ensure internal notes never create ticket notifications

CREATE OR REPLACE FUNCTION public.notify_ticket_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
BEGIN
  -- Internal note: do not notify ticket creator/assignee.
  IF COALESCE(NEW.is_internal_note, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT created_by, assigned_to_user_id
  INTO t
  FROM public.tickets
  WHERE id = NEW.ticket_id;

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
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_message();

NOTIFY pgrst, 'reload schema';
