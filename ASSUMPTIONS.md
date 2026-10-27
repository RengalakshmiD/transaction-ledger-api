# Technical Rationale & Architectural Assumptions

This document outlines the key design choices, assumptions, and engineering trade-offs made during the implementation of the **Transaction Ledger API**.

---

## 1. Monetary Representation & Arithmetic Precision

### Assumption
- Currency is represented in standard decimal units with up to 2 decimal places (e.g. dollars and cents: `10.50`).

### Technical Rationale
- Storing monetary values as IEEE-754 binary floating-point numbers (`FLOAT`/`DOUBLE`) causes rounding drift (e.g., `0.1 + 0.2 = 0.30000000000000004`).
- **PostgreSQL**: We chose `NUMERIC(15, 2)` which stores exact decimal representations with zero rounding errors.
- **Node.js**: Input amounts are validated via Zod (`Number(val.toFixed(2)) === val`) to reject fractional subunits (such as `$10.005`). Arithmetic calculations in the service layer are normalized using epsilon compensation:
  ```ts
  Math.round((val + Number.EPSILON) * 100) / 100
  ```
- **Constraint**: `CHECK (amount > 0)` and `CHECK (balance >= 0)` guarantee that balances can never drop into negative values at the storage engine level.

---

## 2. Idempotency & Reference ID Scope

### Assumption
- Per the specification: *"For the same account, `reference_id` must be unique... The same `reference_id` may be used for different accounts."*

### Technical Rationale
- We enforced this rule both programmatically and via a composite database constraint:
  ```sql
  CONSTRAINT uq_account_reference UNIQUE (account_id, reference_id)
  ```
- When a client sends a transaction request:
  1. The service checks if the `reference_id` already exists for this account.
  2. If found, it halts immediately and returns HTTP `409 Conflict` (`DUPLICATE_TRANSACTION`).
  3. The account balance remains strictly unchanged.
- Reusing the same `reference_id` across two completely different accounts is allowed and will succeed.

---

## 3. Concurrency Control & Double-Spending Prevention

### Assumption
- Multiple clients or concurrent requests may attempt to debit the same account at the exact same millisecond.

### Technical Rationale
- A naive check-then-update pattern:
  ```sql
  -- VULNERABLE TO RACE CONDITIONS:
  SELECT balance FROM accounts WHERE id = '...'; -- Thread 1 reads 100
  SELECT balance FROM accounts WHERE id = '...'; -- Thread 2 reads 100
  -- Both threads approve a debit of 70, resulting in negative balance!
  ```
- **Solution**: We employ pessimistic row-level locking:
  ```sql
  SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE;
  ```
- Any subsequent concurrent request for the same account row is blocked at the database engine until the active transaction completes (`COMMIT` or `ROLLBACK`). This guarantees complete isolation and serializability for account balance transitions.

---

## 4. Deadlock Prevention in Inter-Account Transfers (Bonus)

### Assumption
- Account A may transfer to Account B at the same time Account B transfers to Account A.

### Technical Rationale
- If Thread 1 locks Account A first then attempts to lock Account B, while Thread 2 locks Account B first then attempts to lock Account A, a **database deadlock** occurs.
- **Solution**: In `TransferService`, account IDs are always sorted lexicographically (`ORDER BY id`) before acquiring locks:
  ```sql
  SELECT id, balance FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE;
  ```
- Because both threads request locks in the identical deterministic sequence, cyclic wait conditions are mathematically impossible, completely eliminating deadlocks.

---

## 5. Ledger Immutability & Double-Entry Accounting

### Assumption
- Once written, transaction history must be permanent and audit-proof.

### Technical Rationale
- No `PUT`, `PATCH`, or `DELETE` endpoints exist for transaction records.
- Foreign keys on transactions use `ON DELETE RESTRICT` so that accounts with transaction histories cannot be accidentally removed.
- In the **Money Transfer API**, two distinct ledger entries are written:
  1. A `debit` entry on the sender's account.
  2. A `credit` entry on the receiver's account.
- Both entries are written within the same atomic `BEGIN ... COMMIT` block. If either write fails, the entire transaction is rolled back, guaranteeing that a partial transfer is impossible.

---

## 6. Pagination & Query Safeguards

### Assumption
- Ledger transaction history will grow over time and must not cause Out-Of-Memory (OOM) or latency degradation.

### Technical Rationale
- `GET /api/v1/accounts/:accountId/transactions` enforces pagination:
  - Default `page = 1`
  - Default `limit = 10`
  - Maximum `limit = 100` (enforced via Zod schema to avoid unbounded query attacks).
- An index on `(account_id, created_at DESC)` supports index-only or index-assisted scans for latest-first sorting.

---

## 7. Account Creation & Initial Balance

### Assumption
- Clients must never be allowed to set their own initial balance upon creation.

### Technical Rationale
- In the `POST /api/v1/accounts` endpoint, the request body only parses `name`. If a client passes `"balance": 10000`, it is ignored.
- The repository hardcodes `0.00` into the `INSERT` statement, and the database schema sets `DEFAULT 0.00`. Initial balance is guaranteed to be 0 at all times.
