import express, { Application } from 'express';
import cors from 'cors';
import router from './routes';
import { errorHandler } from './middleware/errorHandler';

import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './docs/swagger.json';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Interactive Swagger API Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Routes
  app.use('/', router);

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
