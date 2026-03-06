-- Add actor_user_id to notifications (who performed the action, e.g. who picked up the ticket)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_actor_user_id ON public.notifications(actor_user_id);
