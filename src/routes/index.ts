import { Router, Request, Response } from 'express';
import accountRoutes from './account.routes';
import transferRoutes from './transfer.routes';
import { NotFoundError } from '../errors/appError';

const router = Router();

// Health Check Endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Transaction Ledger API',
  });
});

// Mount Resource Routes
router.use('/api/v1/accounts', accountRoutes);
router.use('/api/v1/transfers', transferRoutes);

// Fallback for unhandled routes
router.use('*', (req: Request) => {
  throw new NotFoundError(`Endpoint '${req.method} ${req.originalUrl}' does not exist on this server.`);
});

export default router;
