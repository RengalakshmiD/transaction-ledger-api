import { Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service';

export class TransactionController {
  async addTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const { type, amount, description, reference_id } = req.body;

      const result = await transactionService.addTransaction(accountId, {
        type,
        amount,
        description,
        reference_id,
      });

      res.status(201).json({
        success: true,
        message: 'Transaction processed successfully',
        data: result.transaction,
        account_balance: result.new_balance,
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const { type, page, limit } = req.query as any;

      const result = await transactionService.getHistory(accountId, {
        type,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transactionController = new TransactionController();
