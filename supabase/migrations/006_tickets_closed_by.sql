-- Quem encerrou o chamado (autor ou atendente)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tickets.closed_by_user_id IS 'Usuário que encerrou o chamado (autor ou atendente).';

CREATE INDEX IF NOT EXISTS idx_tickets_closed_by ON public.tickets(closed_by_user_id);
