import { pool } from '../config/database';
import { accountRepository } from '../repositories/account.repository';
import { transactionRepository } from '../repositories/transaction.repository';
import { TransferDTO } from '../types';
import {
  NotFoundError,
  InsufficientBalanceError,
  ConflictError,
  BadRequestError,
} from '../errors/appError';

export class TransferService {
  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  async transferFunds(dto: TransferDTO) {
    if (dto.from_account_id === dto.to_account_id) {
      throw new BadRequestError('Source and destination accounts must be different.', 'SAME_ACCOUNT_TRANSFER');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Lock both accounts in sorted order to avoid deadlocks
      const accounts = await accountRepository.findMultipleByIdsForUpdate(
        [dto.from_account_id, dto.to_account_id],
        client
      );

      if (accounts.length < 2) {
        const foundIds = accounts.map((a) => a.id);
        const missingId =
          !foundIds.includes(dto.from_account_id) ? dto.from_account_id : dto.to_account_id;
        throw new NotFoundError(
          `Account with ID '${missingId}' does not exist. Both accounts must exist to complete a transfer.`,
          'ACCOUNT_NOT_FOUND'
        );
      }

      const fromAccount = accounts.find((a) => a.id === dto.from_account_id)!;
      const toAccount = accounts.find((a) => a.id === dto.to_account_id)!;

      // 2. Check for duplicate reference_id in either account
      const [existingSourceTx, existingDestTx] = await Promise.all([
        transactionRepository.findByAccountAndReference(dto.from_account_id, dto.reference_id, client),
        transactionRepository.findByAccountAndReference(dto.to_account_id, dto.reference_id, client),
      ]);

      if (existingSourceTx || existingDestTx) {
        throw new ConflictError(
          `A transfer with reference_id '${dto.reference_id}' has already been processed.`,
          'DUPLICATE_TRANSACTION'
        );
      }

      // 3. Check source balance
      if (fromAccount.balance < dto.amount) {
        throw new InsufficientBalanceError(
          `Source account balance (${fromAccount.balance.toFixed(2)}) is insufficient for transfer of ${dto.amount.toFixed(2)}.`,
          'INSUFFICIENT_BALANCE'
        );
      }

      // 4. Calculate new balances
      const newFromBalance = this.roundMoney(fromAccount.balance - dto.amount);
      const newToBalance = this.roundMoney(toAccount.balance + dto.amount);

      // 5. Update balances atomically
      await accountRepository.updateBalance(dto.from_account_id, newFromBalance, client);
      await accountRepository.updateBalance(dto.to_account_id, newToBalance, client);

      // 6. Create debit transaction record for source account
      const debitTx = await transactionRepository.create(
        {
          account_id: dto.from_account_id,
          type: 'debit',
          amount: dto.amount,
          description: dto.description || `Transfer to account ${dto.to_account_id}`,
          reference_id: dto.reference_id,
        },
        client
      );

      // 7. Create credit transaction record for destination account
      const creditTx = await transactionRepository.create(
        {
          account_id: dto.to_account_id,
          type: 'credit',
          amount: dto.amount,
          description: dto.description || `Transfer from account ${dto.from_account_id}`,
          reference_id: dto.reference_id,
        },
        client
      );

      // 8. Commit atomic transaction
      await client.query('COMMIT');

      return {
        reference_id: dto.reference_id,
        amount: dto.amount,
        from_account: {
          id: fromAccount.id,
          previous_balance: fromAccount.balance,
          new_balance: newFromBalance,
          transaction_id: debitTx.id,
        },
        to_account: {
          id: toAccount.id,
          previous_balance: toAccount.balance,
          new_balance: newToBalance,
          transaction_id: creditTx.id,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const transferService = new TransferService();
