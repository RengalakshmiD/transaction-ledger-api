import { z } from 'zod';

export const transferSchema = {
  body: z
    .object({
      from_account_id: z
        .string({ required_error: 'from_account_id is required' })
        .uuid('Invalid from_account_id format. Must be a valid UUID'),
      to_account_id: z
        .string({ required_error: 'to_account_id is required' })
        .uuid('Invalid to_account_id format. Must be a valid UUID'),
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
    })
    .refine((data) => data.from_account_id !== data.to_account_id, {
      message: 'Source and destination accounts must be different',
      path: ['to_account_id'],
    }),
};
