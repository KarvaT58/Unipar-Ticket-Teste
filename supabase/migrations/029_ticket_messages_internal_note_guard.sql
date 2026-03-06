-- Guard migration for environments where internal note schema/policies were not applied.
-- Safe to run multiple times.

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS is_internal_note BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ticket_messages.is_internal_note IS
  'When true, only users in the ticket target sector can view this message.';

-- Keep edit/delete fields resilient as well.
ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Recreate sector-aware SELECT policy for internal notes.
DROP POLICY IF EXISTS "Users can view messages" ON public.ticket_messages;
DROP POLICY IF EXISTS "Users can view messages or internal notes in own sector" ON public.ticket_messages;

CREATE POLICY "Users can view messages or internal notes in own sector"
  ON public.ticket_messages FOR SELECT
  TO authenticated
  USING (
    NOT is_internal_note
    OR EXISTS (
      SELECT 1
      FROM public.tickets t
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = ticket_messages.ticket_id
        AND t.target_sector = p.department
    )
  );

-- Recreate INSERT policy to validate internal note writes.
DROP POLICY IF EXISTS "Users can insert messages" ON public.ticket_messages;

CREATE POLICY "Users can insert messages"
  ON public.ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      NOT is_internal_note
      OR EXISTS (
        SELECT 1
        FROM public.tickets t
        INNER JOIN public.profiles p ON p.id = auth.uid()
        WHERE t.id = ticket_id
          AND t.target_sector = p.department
      )
    )
  );

-- Ensure PostgREST sees fresh schema immediately.
NOTIFY pgrst, 'reload schema';
