import { Request, Response, NextFunction } from 'express';
import { accountService } from '../services/account.service';

export class AccountController {
  async createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const account = await accountService.createAccount({ name: req.body.name });
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const data = await accountService.getBalance(accountId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllAccounts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await accountService.getAllAccounts();
      res.status(200).json({
        success: true,
        count: accounts.length,
        data: accounts,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const accountController = new AccountController();
