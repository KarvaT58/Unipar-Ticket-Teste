-- Avatar de perfil: coluna em profiles + bucket de storage
-- profiles já existe (id, name, email, department, role). Adicionar avatar_url.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Criar bucket "avatars" no Dashboard: Storage > New bucket > nome "avatars", Public: ON, Max size 2MB.
-- Mime types permitidos: image/jpeg, image/png, image/gif, image/webp
-- Depois execute as políticas abaixo no SQL Editor (ou aplique esta migration).

-- Políticas no storage.objects (bucket "avatars" deve existir).
-- Criar o bucket no Dashboard: Storage > New bucket > nome "avatars", Public: ON, Max size 2MB.
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Permitir que o usuário atualize o próprio perfil (avatar_url)
-- Se a tabela profiles já tiver RLS com outras políticas, ignore erros de duplicata.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view profiles') THEN
    CREATE POLICY "Users can view profiles"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
