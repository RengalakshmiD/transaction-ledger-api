import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { Transaction, TransactionType } from '../types';

export class TransactionRepository {
  async create(
    data: {
      account_id: string;
      type: TransactionType;
      amount: number;
      description?: string | null;
      reference_id: string;
    },
    client: PoolClient
  ): Promise<Transaction> {
    const query = `
      INSERT INTO transactions (account_id, type, amount, description, reference_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, account_id, type, amount, description, reference_id, created_at;
    `;
    const result = await client.query(query, [
      data.account_id,
      data.type,
      data.amount,
      data.description || null,
      data.reference_id,
    ]);
    return result.rows[0];
  }

  async findByAccountAndReference(
    accountId: string,
    referenceId: string,
    client?: PoolClient
  ): Promise<Transaction | null> {
    const query = `
      SELECT id, account_id, type, amount, description, reference_id, created_at
      FROM transactions
      WHERE account_id = $1 AND reference_id = $2;
    `;
    const runner = client || pool;
    const result = await runner.query(query, [accountId, referenceId]);
    return result.rows[0] || null;
  }

  async findHistory(
    accountId: string,
    type?: TransactionType,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const params: any[] = [accountId];
    let whereClause = 'WHERE account_id = $1';

    if (type) {
      params.push(type);
      whereClause += ` AND type = $${params.length}`;
    }

    // 1. Get total matching count
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM transactions
      ${whereClause};
    `;
    const countResult = await pool.query(countQuery, params);
    const total = countResult.rows[0]?.total || 0;

    // 2. Get paginated results ordered by latest first
    params.push(limit);
    const limitParamIdx = params.length;
    params.push(offset);
    const offsetParamIdx = params.length;

    const dataQuery = `
      SELECT id, account_id, type, amount, description, reference_id, created_at
      FROM transactions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};
    `;
    const dataResult = await pool.query(dataQuery, params);

    return {
      transactions: dataResult.rows,
      total,
    };
  }
}

export const transactionRepository = new TransactionRepository();
