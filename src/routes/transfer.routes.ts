import { Router } from 'express';
import { transferController } from '../controllers/transfer.controller';
import { validate } from '../middleware/validate';
import { transferSchema } from '../schemas/transfer.schema';

const router = Router();

// Bonus: Inter-Account Money Transfer
router.post(
  '/',
  validate(transferSchema),
  transferController.transfer
);

export default router;
