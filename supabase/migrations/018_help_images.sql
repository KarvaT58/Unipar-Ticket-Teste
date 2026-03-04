-- Table for Help page (Ajuda): images shown to users (tutorials, manuals, etc.)
CREATE TABLE IF NOT EXISTS public.help_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.help_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view help images"
  ON public.help_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert help images"
  ON public.help_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (LOWER(TRIM(profiles.role)) = 'admin' OR UPPER(TRIM(profiles.department)) = 'ADMINISTRAÇÃO')
    )
  );

CREATE POLICY "Only admins can update help images"
  ON public.help_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (LOWER(TRIM(profiles.role)) = 'admin' OR UPPER(TRIM(profiles.department)) = 'ADMINISTRAÇÃO')
    )
  );

CREATE POLICY "Only admins can delete help images"
  ON public.help_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (LOWER(TRIM(profiles.role)) = 'admin' OR UPPER(TRIM(profiles.department)) = 'ADMINISTRAÇÃO')
    )
  );
