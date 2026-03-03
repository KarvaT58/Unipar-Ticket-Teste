-- Chat interno 1-a-1: conversas, mensagens, pins e storage

-- Conversas entre dois usuários (user_a_id < user_b_id para evitar duplicatas)
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_user_order CHECK (user_a_id < user_b_id),
  CONSTRAINT chat_conversations_unique_pair UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_a ON public.chat_conversations(user_a_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_b ON public.chat_conversations(user_b_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON public.chat_conversations(last_message_at DESC NULLS LAST);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Users can insert conversations"
  ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_a_id OR auth.uid() = user_b_id)
    AND user_a_id < user_b_id
  );

-- Mensagens do chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'voice', 'document')),
  file_path TEXT,
  file_name TEXT,
  is_priority BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(conversation_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

-- Mensagens fixadas por usuário (para si mesmo)
CREATE TABLE IF NOT EXISTS public.chat_message_pins (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_pins_user ON public.chat_message_pins(user_id);

ALTER TABLE public.chat_message_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own message pins"
  ON public.chat_message_pins FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conversas fixadas na sidebar por usuário
CREATE TABLE IF NOT EXISTS public.chat_pinned_conversations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_pinned_conversations_user ON public.chat_pinned_conversations(user_id);

ALTER TABLE public.chat_pinned_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pinned conversations"
  ON public.chat_pinned_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger: atualizar last_message_at da conversa ao inserir mensagem
CREATE OR REPLACE FUNCTION public.update_chat_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS chat_messages_update_last ON public.chat_messages;
CREATE TRIGGER chat_messages_update_last
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_conversation_last_message();

-- Realtime: mensagens novas chegam em tempo real no cliente
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Storage bucket para anexos do chat
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', false, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;

DROP POLICY IF EXISTS "Authenticated can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authenticated can read chat attachments" ON storage.objects;
CREATE POLICY "Authenticated can read chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authenticated can delete chat attachments" ON storage.objects;
CREATE POLICY "Authenticated can delete chat attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments');
