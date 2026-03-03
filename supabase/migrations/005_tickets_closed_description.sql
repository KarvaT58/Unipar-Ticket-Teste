-- Descrição obrigatória ao encerrar chamado
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS closed_description TEXT;

COMMENT ON COLUMN public.tickets.closed_description IS 'Descrição obrigatória ao encerrar o chamado (preenchida por autor ou atendente).';
