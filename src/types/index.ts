export type TransactionType = 'credit' | 'debit';

export interface Account {
  id: string;
  name: string;
  balance: number;
  created_at: Date;
}

export interface Transaction {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  reference_id: string;
  created_at: Date;
}

export interface CreateAccountDTO {
  name: string;
}

export interface CreateTransactionDTO {
  type: TransactionType;
  amount: number;
  description?: string;
  reference_id: string;
}

export interface TransferDTO {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  reference_id: string;
  description?: string;
}

export interface PaginationMeta {
  current_page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}
