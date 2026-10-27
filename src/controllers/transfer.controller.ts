import { Request, Response, NextFunction } from 'express';
import { transferService } from '../services/transfer.service';

export class TransferController {
  async transfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await transferService.transferFunds(req.body);
      res.status(200).json({
        success: true,
        message: 'Funds transferred successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transferController = new TransferController();
