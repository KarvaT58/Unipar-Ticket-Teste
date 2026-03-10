-- Garantir que a tabela profiles está no Realtime e que UPDATE envia o payload completo.
-- Execute esta migration se o status da equipe não atualizar em tempo real.

-- 1. Adicionar tabela à publicação do Realtime (se ainda não estiver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- 2. REPLICA IDENTITY FULL: necessário para o payload.new conter todas as colunas no UPDATE
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
