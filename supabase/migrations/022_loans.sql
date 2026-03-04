-- Loans (empréstimos): user borrows an item from a sector
-- sector = department code (from SECTORS); only that sector sees the loan list

CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector TEXT NOT NULL,
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  return_date DATE NOT NULL,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON public.loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_sector ON public.loans(sector);
CREATE INDEX IF NOT EXISTS idx_loans_return_date ON public.loans(return_date);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- INSERT: only as borrower (borrower_id must be current user)
CREATE POLICY "Users can create loans as borrower"
  ON public.loans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = borrower_id);

-- SELECT: own loans or loans of own sector
CREATE POLICY "Users can view own loans or sector loans"
  ON public.loans FOR SELECT
  TO authenticated
  USING (
    borrower_id = auth.uid()
    OR sector = (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

-- UPDATE: borrower (e.g. postpone) or same sector (e.g. mark returned)
CREATE POLICY "Users can update own or sector loans"
  ON public.loans FOR UPDATE
  TO authenticated
  USING (
    borrower_id = auth.uid()
    OR sector = (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    borrower_id = auth.uid()
    OR sector = (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

-- loan_attachments (photos for the loan)
CREATE TABLE IF NOT EXISTS public.loan_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_attachments_loan_id ON public.loan_attachments(loan_id);

ALTER TABLE public.loan_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert loan attachments for own loans"
  ON public.loan_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.loans
      WHERE id = loan_id AND borrower_id = auth.uid()
    )
  );

CREATE POLICY "Users can view loan attachments for visible loans"
  ON public.loan_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id
      AND (l.borrower_id = auth.uid() OR l.sector = (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1))
    )
  );

-- Storage bucket for loan photos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('loan-attachments', 'loan-attachments', false, 10485760)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

DROP POLICY IF EXISTS "Authenticated can upload loan attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload loan attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'loan-attachments');

DROP POLICY IF EXISTS "Authenticated can read loan attachments" ON storage.objects;
CREATE POLICY "Authenticated can read loan attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'loan-attachments');

DROP POLICY IF EXISTS "Authenticated can delete loan attachments" ON storage.objects;
CREATE POLICY "Authenticated can delete loan attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'loan-attachments');

-- Force PostgREST (Supabase REST API) to reload schema cache so /rest/v1/loans is available
NOTIFY pgrst, 'reload schema';
