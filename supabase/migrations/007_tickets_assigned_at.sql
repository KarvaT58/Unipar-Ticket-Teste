-- Data em que o chamado entrou em atendimento (status = in_progress)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tickets.assigned_at IS 'Data/hora em que o chamado foi assumido (entrou em atendimento).';

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_at ON public.tickets(assigned_at) WHERE assigned_at IS NOT NULL;
