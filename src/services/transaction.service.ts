import { pool } from '../config/database';
import { accountRepository } from '../repositories/account.repository';
import { transactionRepository } from '../repositories/transaction.repository';
import {
  CreateTransactionDTO,
  Transaction,
  PaginatedResult,
  TransactionType,
} from '../types';
import {
  NotFoundError,
  InsufficientBalanceError,
  ConflictError,
} from '../errors/appError';

export class TransactionService {
  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  async addTransaction(
    accountId: string,
    dto: CreateTransactionDTO
  ): Promise<{ transaction: Transaction; new_balance: number }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Acquire pessimistic lock on the account row to prevent race conditions
      const account = await accountRepository.findByIdForUpdate(accountId, client);
      if (!account) {
        throw new NotFoundError(
          `Account with ID '${accountId}' does not exist.`,
          'ACCOUNT_NOT_FOUND'
        );
      }

      // 2. Check for duplicate reference_id within this account
      const existingTx = await transactionRepository.findByAccountAndReference(
        accountId,
        dto.reference_id,
        client
      );
      if (existingTx) {
        throw new ConflictError(
          `Transaction with reference_id '${dto.reference_id}' already exists for account '${accountId}'.`,
          'DUPLICATE_TRANSACTION'
        );
      }

      // 3. Compute new balance based on transaction type
      let newBalance = account.balance;
      if (dto.type === 'debit') {
        if (account.balance < dto.amount) {
          throw new InsufficientBalanceError(
            `Insufficient funds. Current balance is ${account.balance.toFixed(
              2
            )}, but tried to debit ${dto.amount.toFixed(2)}.`,
            'INSUFFICIENT_BALANCE'
          );
        }
        newBalance = this.roundMoney(account.balance - dto.amount);
      } else if (dto.type === 'credit') {
        newBalance = this.roundMoney(account.balance + dto.amount);
      }

      // 4. Update the account balance atomically
      await accountRepository.updateBalance(accountId, newBalance, client);

      // 5. Insert the immutable transaction record
      const transaction = await transactionRepository.create(
        {
          account_id: accountId,
          type: dto.type,
          amount: dto.amount,
          description: dto.description,
          reference_id: dto.reference_id,
        },
        client
      );

      // 6. Commit the atomic transaction
      await client.query('COMMIT');

      return {
        transaction,
        new_balance: newBalance,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getHistory(
    accountId: string,
    filters: { type?: TransactionType; page: number; limit: number }
  ): Promise<PaginatedResult<Transaction>> {
    // Verify account exists first
    const account = await accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundError(
        `Account with ID '${accountId}' does not exist.`,
        'ACCOUNT_NOT_FOUND'
      );
    }

    const { page, limit, type } = filters;
    const offset = (page - 1) * limit;

    const { transactions, total } = await transactionRepository.findHistory(
      accountId,
      type,
      limit,
      offset
    );

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    return {
      data: transactions,
      pagination: {
        current_page: page,
        page_size: limit,
        total_records: total,
        total_pages: totalPages,
      },
    };
  }
}

export const transactionService = new TransactionService();
