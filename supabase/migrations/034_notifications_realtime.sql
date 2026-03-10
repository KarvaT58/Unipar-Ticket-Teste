-- Enable Realtime for notifications so the sidebar and fila badges update when
-- a ticket is returned to queue (or any other notification is inserted).
-- The notification-context subscribes with filter user_id=eq.<profile.id>.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
