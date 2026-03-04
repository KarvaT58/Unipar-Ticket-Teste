-- Notify on ticket updates: closed, reopened, transferred, returned to queue

CREATE OR REPLACE FUNCTION public.notify_ticket_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ticket closed: notify author
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed' THEN
    INSERT INTO public.notifications (user_id, ticket_id, type)
    VALUES (NEW.created_by, NEW.id, 'ticket_closed');
  END IF;

  -- Ticket reopened (was closed, now queue or in_progress): notify author and sector
  IF OLD.status = 'closed' AND NEW.status IS DISTINCT FROM 'closed' THEN
    INSERT INTO public.notifications (user_id, ticket_id, type)
    VALUES (NEW.created_by, NEW.id, 'ticket_reopened');
    INSERT INTO public.notifications (user_id, ticket_id, type)
    SELECT p.id, NEW.id, 'ticket_reopened'
    FROM public.profiles p
    WHERE p.department = NEW.target_sector
      AND p.id != NEW.created_by;
  END IF;

  -- Assigned to someone: notify new assignee
  IF OLD.assigned_to_user_id IS DISTINCT FROM NEW.assigned_to_user_id
     AND NEW.assigned_to_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, ticket_id, type)
    VALUES (NEW.assigned_to_user_id, NEW.id, 'ticket_transferred');
  END IF;

  -- Returned to queue (was in progress, now unassigned): notify sector
  IF OLD.status = 'in_progress' AND NEW.status = 'queue' AND NEW.assigned_to_user_id IS NULL THEN
    INSERT INTO public.notifications (user_id, ticket_id, type)
    SELECT p.id, NEW.id, 'ticket_returned_to_queue'
    FROM public.profiles p
    WHERE p.department = NEW.target_sector
      AND p.id != NEW.created_by;
  END IF;

  -- Target sector changed: notify new sector (transfer to another sector)
  IF OLD.target_sector IS DISTINCT FROM NEW.target_sector THEN
    INSERT INTO public.notifications (user_id, ticket_id, type)
    SELECT p.id, NEW.id, 'ticket_transferred'
    FROM public.profiles p
    WHERE p.department = NEW.target_sector
      AND p.id != NEW.created_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ticket_updated_notify ON public.tickets;
CREATE TRIGGER on_ticket_updated_notify
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ticket_updated();
