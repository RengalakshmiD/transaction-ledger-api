import { createApp } from './app';
import { config } from './config/env';
import { pool } from './config/database';
import { runMigrations } from './db/migrate';

async function bootstrap() {
  try {
    // 1. Ensure database schema and extensions are up-to-date
    await runMigrations();

    // 2. Start Express application
    const app = createApp();
    const server = app.listen(config.port, () => {
      console.log(`🚀 Transaction Ledger API is running on port ${config.port} [${config.nodeEnv}]`);
      console.log(`📖 Swagger UI Docs: http://localhost:${config.port}/api-docs`);
      console.log(`📍 Health Check: http://localhost:${config.port}/health`);
      console.log(`📍 Accounts API: http://localhost:${config.port}/api/v1/accounts`);
    });

    // Graceful Shutdown handlers
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await pool.end();
          console.log('PostgreSQL pool connections closed.');
          process.exit(0);
        } catch (err) {
          console.error('Error closing database pool:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

bootstrap();
