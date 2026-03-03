-- Anexos de chamados (imagens, vídeos, áudios, documentos)
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert ticket attachments"
  ON public.ticket_attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can view ticket attachments"
  ON public.ticket_attachments FOR SELECT
  TO authenticated
  USING (true);

-- Bucket no Storage (execute no SQL Editor se o bucket não existir):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('ticket-attachments', 'ticket-attachments', false, 52428800) ON CONFLICT (id) DO NOTHING;
-- CREATE POLICY "Authenticated users can upload ticket attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket-attachments');
-- CREATE POLICY "Authenticated users can read ticket attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ticket-attachments');
