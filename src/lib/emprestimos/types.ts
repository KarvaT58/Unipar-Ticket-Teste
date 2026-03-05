export type Loan = {
  id: string
  sector: string
  /** User who created the loan (lending the item). Null = legacy borrower-created loan. */
  lender_id: string | null
  borrower_id: string
  title: string
  description: string | null
  return_date: string
  returned_at: string | null
  created_at: string
  updated_at: string
}

export type LoanAttachment = {
  id: string
  loan_id: string
  uploaded_by: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number | null
  created_at: string
}

export type LoanWithBorrower = Loan & {
  profiles?: { name: string | null } | null
}

export type LoanWithAttachments = Loan & {
  loan_attachments?: LoanAttachment[]
}

export type LoanWithNames = Loan & {
  borrower_name?: string | null
  lender_name?: string | null
}
