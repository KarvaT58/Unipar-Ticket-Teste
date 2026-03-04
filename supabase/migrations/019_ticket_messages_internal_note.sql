-- Internal notes: only visible to users in the ticket's target_sector (same department)

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS is_internal_note BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ticket_messages.is_internal_note IS 'When true, only users whose department = ticket.target_sector can see this message.';

-- Drop existing permissive SELECT so we can replace with sector-aware policy
DROP POLICY IF EXISTS "Users can view messages" ON public.ticket_messages;

-- SELECT: user sees message if it is not internal, OR if it is internal and user is in ticket's target_sector
CREATE POLICY "Users can view messages or internal notes in own sector"
  ON public.ticket_messages FOR SELECT
  TO authenticated
  USING (
    NOT is_internal_note
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = ticket_messages.ticket_id
        AND t.target_sector = p.department
    )
  );

-- INSERT: user can always insert with is_internal_note = false; can insert is_internal_note = true only if in ticket's target_sector
DROP POLICY IF EXISTS "Users can insert messages" ON public.ticket_messages;

CREATE POLICY "Users can insert messages"
  ON public.ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      NOT is_internal_note
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        INNER JOIN public.profiles p ON p.id = auth.uid()
        WHERE t.id = ticket_id
          AND t.target_sector = p.department
      )
    )
  );
