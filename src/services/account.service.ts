import { accountRepository } from '../repositories/account.repository';
import { CreateAccountDTO, Account } from '../types';
import { NotFoundError } from '../errors/appError';

export class AccountService {
  async createAccount(data: CreateAccountDTO): Promise<Account> {
    // Initial balance is guaranteed to be 0 at the repository and database level
    return await accountRepository.create(data.name);
  }

  async getBalance(accountId: string): Promise<{ account_id: string; balance: number }> {
    const account = await accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundError(`Account with ID '${accountId}' does not exist.`, 'ACCOUNT_NOT_FOUND');
    }
    return {
      account_id: account.id,
      balance: account.balance,
    };
  }

  async getAccountById(accountId: string): Promise<Account> {
    const account = await accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundError(`Account with ID '${accountId}' does not exist.`, 'ACCOUNT_NOT_FOUND');
    }
    return account;
  }

  async getAllAccounts(): Promise<Account[]> {
    return await accountRepository.findAll();
  }
}

export const accountService = new AccountService();
