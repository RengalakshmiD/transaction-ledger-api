import { z } from 'zod';

export const createTransactionSchema = {
  params: z.object({
    accountId: z
      .string({ required_error: 'Account ID is required' })
      .uuid('Invalid account ID format. Must be a valid UUID'),
  }),
  body: z.object({
    type: z.enum(['credit', 'debit'], {
      errorMap: () => ({ message: "Transaction type must be either 'credit' or 'debit'" }),
    }),
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive('Amount must be greater than 0')
      .refine(
        (val) => Number(val.toFixed(2)) === val,
        'Amount cannot have more than 2 decimal places'
      ),
    reference_id: z
      .string({ required_error: 'reference_id is required' })
      .trim()
      .min(1, 'reference_id cannot be empty')
      .max(255, 'reference_id cannot exceed 255 characters'),
    description: z.string().trim().max(1000).optional(),
  }),
};

export const getTransactionsSchema = {
  params: z.object({
    accountId: z
      .string({ required_error: 'Account ID is required' })
      .uuid('Invalid account ID format. Must be a valid UUID'),
  }),
  query: z.object({
    type: z.enum(['credit', 'debit']).optional(),
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1, {
        message: 'Page must be a positive integer greater than or equal to 1',
      }),
    limit: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
        message: 'Limit must be an integer between 1 and 100',
      }),
  }),
};
