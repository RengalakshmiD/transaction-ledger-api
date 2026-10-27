import { Router } from 'express';
import { accountController } from '../controllers/account.controller';
import { transactionController } from '../controllers/transaction.controller';
import { validate } from '../middleware/validate';
import { createAccountSchema, accountParamsSchema } from '../schemas/account.schema';
import {
  createTransactionSchema,
  getTransactionsSchema,
} from '../schemas/transaction.schema';

const router = Router();

// 1. Create Account
router.post(
  '/',
  validate(createAccountSchema),
  accountController.createAccount
);

// List All Accounts (Convenience endpoint for browsers/testing)
router.get(
  '/',
  accountController.getAllAccounts
);

// 2. Get Account Balance
router.get(
  '/:accountId/balance',
  validate(accountParamsSchema),
  accountController.getBalance
);

// 3. Add Transaction to Account
router.post(
  '/:accountId/transactions',
  validate(createTransactionSchema),
  transactionController.addTransaction
);

// 4. Get Transaction History for Account (with filtering & pagination)
router.get(
  '/:accountId/transactions',
  validate(getTransactionsSchema),
  transactionController.getHistory
);

export default router;
