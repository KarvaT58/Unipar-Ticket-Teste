-- Notify sector users when a new ticket is created (so TI etc. get notified when someone opens a chamado)
CREATE OR REPLACE FUNCTION public.notify_new_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, ticket_id, ticket_message_id, type)
  SELECT p.id, NEW.id, NULL, 'new_ticket'
  FROM public.profiles p
  WHERE p.department = NEW.target_sector
    AND p.id != NEW.created_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ticket_created_notify ON public.tickets;
CREATE TRIGGER on_ticket_created_notify
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_ticket();
