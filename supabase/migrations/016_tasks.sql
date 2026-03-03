-- CRM Kanban: boards (columns), tasks, attachments; extend notifications for task deadlines

-- Boards = Kanban columns (per user)
CREATE TABLE IF NOT EXISTS public.task_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_boards_user_id ON public.task_boards(user_id);
CREATE INDEX IF NOT EXISTS idx_task_boards_user_position ON public.task_boards(user_id, position);

ALTER TABLE public.task_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own task boards"
  ON public.task_boards FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  tags TEXT[] DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  deadline_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON public.tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board_position ON public.tasks(board_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(user_id, due_date, due_time) WHERE due_date IS NOT NULL OR due_time IS NOT NULL;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Task attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage attachments of own tasks"
  ON public.task_attachments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.user_id = auth.uid()
    )
  );

-- Extend notifications for task deadlines
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_entity_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_entity_check CHECK (
    (ticket_id IS NOT NULL AND announcement_id IS NULL AND chat_conversation_id IS NULL AND task_id IS NULL)
    OR (ticket_id IS NULL AND announcement_id IS NOT NULL AND chat_conversation_id IS NULL AND task_id IS NULL)
    OR (ticket_id IS NULL AND announcement_id IS NULL AND chat_conversation_id IS NOT NULL AND task_id IS NULL)
    OR (ticket_id IS NULL AND announcement_id IS NULL AND chat_conversation_id IS NULL AND task_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON public.notifications(task_id);

-- Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-attachments', 'task-attachments', false, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;

DROP POLICY IF EXISTS "Authenticated can upload task attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload task attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "Authenticated can read task attachments" ON storage.objects;
CREATE POLICY "Authenticated can read task attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "Authenticated can delete task attachments" ON storage.objects;
CREATE POLICY "Authenticated can delete task attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments');

-- Realtime for tasks (multi-tab sync). Skip if already added.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END $$;
