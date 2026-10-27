import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { Account } from '../types';

export class AccountRepository {
  async create(name: string, client?: PoolClient): Promise<Account> {
    const query = `
      INSERT INTO accounts (name, balance)
      VALUES ($1, 0.00)
      RETURNING id, name, balance, created_at;
    `;
    const runner = client || pool;
    const result = await runner.query(query, [name]);
    return result.rows[0];
  }

  async findById(id: string, client?: PoolClient): Promise<Account | null> {
    const query = `
      SELECT id, name, balance, created_at
      FROM accounts
      WHERE id = $1;
    `;
    const runner = client || pool;
    const result = await runner.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByIdForUpdate(id: string, client: PoolClient): Promise<Account | null> {
    const query = `
      SELECT id, name, balance, created_at
      FROM accounts
      WHERE id = $1
      FOR UPDATE;
    `;
    const result = await client.query(query, [id]);
    return result.rows[0] || null;
  }

  async findMultipleByIdsForUpdate(ids: string[], client: PoolClient): Promise<Account[]> {
    // Sort IDs to guarantee consistent lock acquisition order and prevent deadlocks
    const sortedIds = [...ids].sort();
    const query = `
      SELECT id, name, balance, created_at
      FROM accounts
      WHERE id = ANY($1::uuid[])
      ORDER BY id
      FOR UPDATE;
    `;
    const result = await client.query(query, [sortedIds]);
    return result.rows;
  }

  async updateBalance(id: string, newBalance: number, client: PoolClient): Promise<Account> {
    const query = `
      UPDATE accounts
      SET balance = $1
      WHERE id = $2
      RETURNING id, name, balance, created_at;
    `;
    const result = await client.query(query, [newBalance, id]);
    return result.rows[0];
  }

  async findAll(): Promise<Account[]> {
    const query = `
      SELECT id, name, balance, created_at
      FROM accounts
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query);
    return result.rows;
  }
}

export const accountRepository = new AccountRepository();
