-- Ramais: sector name, extension number, optional person name
-- All authenticated users can read; only admin can insert/update/delete (enforced in app + optional RLS)

CREATE TABLE IF NOT EXISTS public.ramais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_name TEXT NOT NULL,
  extension_number TEXT NOT NULL,
  person_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ramais_sector ON public.ramais(sector_name);
CREATE INDEX IF NOT EXISTS idx_ramais_extension ON public.ramais(extension_number);

ALTER TABLE public.ramais ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read the list
CREATE POLICY "Authenticated can read ramais"
  ON public.ramais FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete (role check in app; RLS allows if you need server-side enforcement later)
CREATE POLICY "Admins can insert ramais"
  ON public.ramais FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'adm')
    )
  );

CREATE POLICY "Admins can update ramais"
  ON public.ramais FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'adm')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'adm')
    )
  );

CREATE POLICY "Admins can delete ramais"
  ON public.ramais FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'adm')
    )
  );

NOTIFY pgrst, 'reload schema';
