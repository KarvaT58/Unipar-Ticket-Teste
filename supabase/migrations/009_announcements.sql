-- Anúncios/Eventos: tabelas e controle de leitura e popup

-- Tabela principal de anúncios
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  show_as_popup BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view announcements"
  ON public.announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert announcements"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can update own announcements"
  ON public.announcements FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can delete own announcements"
  ON public.announcements FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- Anexos dos anúncios (imagens, vídeos, áudios, documentos)
CREATE TABLE IF NOT EXISTS public.announcement_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcement_attachments_announcement_id ON public.announcement_attachments(announcement_id);

ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view announcement attachments"
  ON public.announcement_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert announcement attachments"
  ON public.announcement_attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.created_by = auth.uid()
    )
  );

CREATE POLICY "Authenticated can delete announcement attachments"
  ON public.announcement_attachments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.created_by = auth.uid()
    )
  );

-- Última leitura por usuário (para badge de não lidos na sidebar)
CREATE TABLE IF NOT EXISTS public.user_announcement_last_read (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_announcement_last_read ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own last read"
  ON public.user_announcement_last_read FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Controle de quem já dispensou o popup de um anúncio
CREATE TABLE IF NOT EXISTS public.announcement_popup_dismissed (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_popup_dismissed_user ON public.announcement_popup_dismissed(user_id);

ALTER TABLE public.announcement_popup_dismissed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own popup dismissed"
  ON public.announcement_popup_dismissed FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own popup dismissed"
  ON public.announcement_popup_dismissed FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at em announcements
CREATE OR REPLACE FUNCTION public.set_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS announcements_updated_at ON public.announcements;
CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_announcements_updated_at();

-- Bucket no Storage: criar manualmente no Dashboard se necessário:
-- Storage > New bucket > id: announcement-attachments, Public: false, Max size: 50MB
-- Políticas (executar no SQL Editor após criar o bucket):
-- CREATE POLICY "Authenticated can upload announcement attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'announcement-attachments');
-- CREATE POLICY "Authenticated can read announcement attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'announcement-attachments');
-- CREATE POLICY "Authenticated can delete own announcement attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'announcement-attachments');
