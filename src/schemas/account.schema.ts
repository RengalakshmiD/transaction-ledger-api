import { z } from 'zod';

export const createAccountSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Account name is required' })
      .trim()
      .min(1, 'Account name cannot be empty')
      .max(255, 'Account name cannot exceed 255 characters'),
  }),
};

export const accountParamsSchema = {
  params: z.object({
    accountId: z
      .string({ required_error: 'Account ID is required' })
      .uuid('Invalid account ID format. Must be a valid UUID'),
  }),
};
