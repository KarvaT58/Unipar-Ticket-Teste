-- Preenche assigned_at para chamados que já estão em atendimento mas não tinham a data
UPDATE public.tickets
SET assigned_at = created_at
WHERE status = 'in_progress'
  AND assigned_to_user_id IS NOT NULL
  AND assigned_at IS NULL;
