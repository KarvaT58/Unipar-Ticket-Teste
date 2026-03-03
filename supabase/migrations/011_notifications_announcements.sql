-- Extend notifications to support announcement notifications (for all users, real-time)

-- Add announcement_id (nullable); one of ticket_id or announcement_id must be set
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE;

-- Make ticket_id nullable so we can have announcement-only notifications
ALTER TABLE public.notifications
  ALTER COLUMN ticket_id DROP NOT NULL;

-- Ensure exactly one of ticket_id or announcement_id is set
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_entity_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_entity_check CHECK (
    (ticket_id IS NOT NULL AND announcement_id IS NULL)
    OR (ticket_id IS NULL AND announcement_id IS NOT NULL)
  );

-- Index for filtering by announcement
CREATE INDEX IF NOT EXISTS idx_notifications_announcement_id ON public.notifications(announcement_id);

-- Allow insert with announcement_id (existing policy "Service can insert notifications" already allows INSERT with CHECK (true))
