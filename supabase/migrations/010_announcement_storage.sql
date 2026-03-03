-- Bucket e políticas para anexos de anúncios
-- O bucket pode ser criado pelo Dashboard (Storage > New bucket) ou pela linha abaixo se a extensão permitir:

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('announcement-attachments', 'announcement-attachments', false, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;

DROP POLICY IF EXISTS "Authenticated can upload announcement attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload announcement attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcement-attachments');

DROP POLICY IF EXISTS "Authenticated can read announcement attachments" ON storage.objects;
CREATE POLICY "Authenticated can read announcement attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'announcement-attachments');

DROP POLICY IF EXISTS "Authenticated can delete announcement attachments" ON storage.objects;
CREATE POLICY "Authenticated can delete announcement attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'announcement-attachments');
