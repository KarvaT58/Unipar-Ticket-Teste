-- Loans: add lender (who creates the loan and lends the item). Borrower is selected by lender.
-- Visibility: lender, borrower, lender's sector, borrower's sector.

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS lender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loans_lender_id ON public.loans(lender_id);

COMMENT ON COLUMN public.loans.lender_id IS 'User who created the loan (lending the item). NULL = legacy row (borrower-created).';
COMMENT ON COLUMN public.loans.borrower_id IS 'User who receives the loan (selected by lender).';
COMMENT ON COLUMN public.loans.sector IS 'Legacy: sector of item. When lender_id is set, lender department is used for visibility.';

-- Drop existing policies to replace with lender/borrower/sector visibility
DROP POLICY IF EXISTS "Users can create loans as borrower" ON public.loans;
DROP POLICY IF EXISTS "Users can view own loans or sector loans" ON public.loans;
DROP POLICY IF EXISTS "Users can update own or sector loans" ON public.loans;

-- INSERT: lender creates (lender_id = me) or legacy borrower creates (lender_id NULL, borrower_id = me)
CREATE POLICY "Users can create loans as lender or borrower"
  ON public.loans FOR INSERT
  TO authenticated
  WITH CHECK (
    (lender_id = auth.uid())
    OR (lender_id IS NULL AND borrower_id = auth.uid())
  );

-- SELECT: visible to lender, borrower, or either one's department
CREATE POLICY "Users can view lender borrower or sector loans"
  ON public.loans FOR SELECT
  TO authenticated
  USING (
    borrower_id = auth.uid()
    OR lender_id = auth.uid()
    OR (
      lender_id IS NOT NULL
      AND (
        (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1) = (SELECT department FROM public.profiles WHERE id = loans.lender_id LIMIT 1)
        OR (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1) = (SELECT department FROM public.profiles WHERE id = loans.borrower_id LIMIT 1)
      )
    )
    OR (lender_id IS NULL AND sector = (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1))
  );

-- UPDATE: same visibility as SELECT (lender, borrower, or either sector)
CREATE POLICY "Users can update lender borrower or sector loans"
  ON public.loans FOR UPDATE
  TO authenticated
  USING (
    borrower_id = auth.uid()
    OR lender_id = auth.uid()
    OR (
      lender_id IS NOT NULL
      AND (
        (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1) = (SELECT department FROM public.profiles WHERE id = loans.lender_id LIMIT 1)
        OR (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1) = (SELECT department FROM public.profiles WHERE id = loans.borrower_id LIMIT 1)
      )
    )
    OR (lender_id IS NULL AND sector = (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1))
  )
  WITH CHECK (
    borrower_id = auth.uid()
    OR lender_id = auth.uid()
    OR (
      lender_id IS NOT NULL
      AND (
        (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1) = (SELECT department FROM public.profiles WHERE id = loans.lender_id LIMIT 1)
        OR (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1) = (SELECT department FROM public.profiles WHERE id = loans.borrower_id LIMIT 1)
      )
    )
    OR (lender_id IS NULL AND sector = (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1))
  );

-- loan_attachments: insert when user is lender or (legacy) borrower of the loan
DROP POLICY IF EXISTS "Users can insert loan attachments for own loans" ON public.loan_attachments;
CREATE POLICY "Users can insert loan attachments for own loans"
  ON public.loan_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id
      AND (l.lender_id = auth.uid() OR (l.lender_id IS NULL AND l.borrower_id = auth.uid()))
    )
  );

-- loan_attachments: select when loan is visible (same as loans SELECT)
DROP POLICY IF EXISTS "Users can view loan attachments for visible loans" ON public.loan_attachments;
CREATE POLICY "Users can view loan attachments for visible loans"
  ON public.loan_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.id = loan_id
      AND (
        l.borrower_id = auth.uid()
        OR l.lender_id = auth.uid()
        OR (
          l.lender_id IS NOT NULL
          AND (
            (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1) = (SELECT department FROM public.profiles WHERE id = l.lender_id LIMIT 1)
            OR (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1) = (SELECT department FROM public.profiles WHERE id = l.borrower_id LIMIT 1)
          )
        )
        OR (l.lender_id IS NULL AND l.sector = (SELECT department FROM public.profiles WHERE id = auth.uid() LIMIT 1))
      )
    )
  );

NOTIFY pgrst, 'reload schema';
