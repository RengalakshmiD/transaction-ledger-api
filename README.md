# Transaction Ledger API

A robust, enterprise-grade backend REST API for a double-entry inspired transaction ledger system. Built with **Node.js**, **TypeScript**, **Express**, and **PostgreSQL**, with strong emphasis on ACID compliance, row-level locking concurrency protection, strict validation, and idempotent transactions.

---

## 🌟 Key Features

1. **Account Management**:
   - Create accounts with unique UUIDs.
   - Initial balance is strictly guaranteed to be `0.00` (tamper-proof against client payloads).
   - Fetch real-time account balance.
2. **Atomic Ledger Transactions**:
   - **Credit**: Atomically increments account balance.
   - **Debit**: Atomically decrements account balance with strict overdraft prevention (`balance >= amount`).
   - Rejection on insufficient balance with HTTP `422 Unprocessable Entity` (balance remains unmodified).
3. **Idempotency & Duplicate Handling**:
   - `reference_id` is unique per account enforced at both application and database constraint levels (`UNIQUE(account_id, reference_id)`).
   - Repeated submissions with the same `reference_id` are rejected with HTTP `409 Conflict` without modifying balances.
   - The same `reference_id` may be reused safely across different accounts.
4. **Transaction Immutability**:
   - Ledger transactions are append-only. No update or delete operations are exposed.
5. **Paginated & Filterable History**:
   - Filter transactions by `type` (`credit`, `debit`, or all).
   - Paginated responses (`page`, `limit`, `total_records`, `total_pages`).
   - Guaranteed sorting in **latest-first** order (`created_at DESC`).
6. **Concurrency & Race Condition Safety**:
   - Uses PostgreSQL row-level pessimistic locking (`SELECT ... FOR UPDATE`) to eliminate double-spending under concurrent requests.
7. **Bonus: Inter-Account Money Transfer**:
   - Atomic two-party transfer (debits source, credits destination in a single database transaction).
   - Rollback guarantee: partial transfers are impossible.
   - Deadlock-free account locking using ordered resource acquisition.

---

## 🛠️ Technology Stack

- **Runtime & Language**: Node.js & TypeScript
- **Web Framework**: Express.js
- **Database**: PostgreSQL (utilizing ACID transactions, constraints, and indexes)
- **Database Client**: `pg` (node-postgres connection pool)
- **Validation**: Zod (strict runtime schema parsing)
- **Containerization**: Docker & Docker Compose (optional for instant zero-config DB)

---

## 📁 Project Architecture

The codebase follows clean layered architecture with clear separation of concerns:

```text
d:/Assesment/
├── docker-compose.yml          # Instant local PostgreSQL container
├── .env.example                # Sample environment configuration
├── .env                        # Local environment variables
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript compiler configuration
├── README.md                   # Project setup and overview
├── API_DOCUMENTATION.md        # Comprehensive API contracts and examples
├── ASSUMPTIONS.md              # Engineering decisions and domain assumptions
├── src/
│   ├── config/
│   │   ├── database.ts         # Connection pool with numeric float parser
│   │   └── env.ts              # Typed environment variables
│   ├── controllers/
│   │   ├── account.controller.ts     # HTTP handlers for accounts & balance
│   │   ├── transaction.controller.ts # HTTP handlers for transactions & history
│   │   └── transfer.controller.ts    # HTTP handler for inter-account transfer
│   ├── services/
│   │   ├── account.service.ts        # Account domain business logic
│   │   ├── transaction.service.ts    # Transaction execution & ACID transactions
│   │   └── transfer.service.ts       # Atomic transfer & deadlock protection
│   ├── repositories/
│   │   ├── account.repository.ts     # SQL queries with row locking (FOR UPDATE)
│   │   └── transaction.repository.ts # SQL queries for ledger entries & pagination
│   ├── middleware/
│   │   ├── validate.ts         # Generic Zod validation middleware
│   │   └── errorHandler.ts     # Centralized HTTP error handler
│   ├── schemas/
│   │   ├── account.schema.ts         # Input schemas for accounts
│   │   ├── transaction.schema.ts     # Input schemas for transactions & queries
│   │   └── transfer.schema.ts        # Input schemas for transfers
│   ├── db/
│   │   ├── init.sql            # Table definitions, constraints, indexes
│   │   └── migrate.ts          # Automatic schema migration runner
│   ├── routes/
│   │   ├── account.routes.ts         # /api/v1/accounts
│   │   ├── transfer.routes.ts        # /api/v1/transfers
│   │   └── index.ts                  # Central router with /health
│   ├── types/
│   │   └── index.ts                  # Core TypeScript types & DTOs
│   ├── errors/
│   │   └── appError.ts               # Custom HTTP error hierarchy
│   ├── app.ts                  # Express application factory
│   └── server.ts               # Application entry point
└── tests/
    └── integration.test.ts     # End-to-end integration test suite
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)
- **PostgreSQL** (local installation or Docker)

---

### Step 1: Clone & Install Dependencies

```bash
# Navigate to the project root
cd d:/Assesment

# Install dependencies
npm install
```

---

### Step 2: Database Setup

You can run PostgreSQL via **Docker Compose** or use your existing local PostgreSQL.

#### Option A: Using Docker Compose (Recommended - Quickest)
If Docker is installed:
```bash
docker compose up -d
```
*This starts a PostgreSQL 16 Alpine container with default credentials matching `.env`.*

#### Option B: Using Existing Local PostgreSQL
1. Ensure PostgreSQL is running.
2. Create a database (e.g. `ledger_db`).
3. Update `.env` with your connection string:
   ```env
   DATABASE_URL=postgresql://<username>:<password>@localhost:5432/<database_name>
   PORT=3000
   NODE_ENV=development
   ```

---

### Step 3: Run Database Migrations

You can run the migration script manually, though the server will also automatically ensure tables and constraints exist on startup:

```bash
npm run migrate
```

---

### Step 4: Run the Application

#### Development Mode (with hot-reload):
```bash
npm run dev
```

#### Production Build & Run:
```bash
npm run build
npm start
```

The server will be running at:
`http://localhost:3000`

---

## 📖 Interactive Swagger API Documentation

Interactive Swagger documentation with a live "Try it out" tester is hosted directly inside the API!

Visit in your browser:
👉 **`http://localhost:3000/api-docs`**

You can inspect schemas, send sample requests, test debit overdraft rejections, and test transfer rollbacks interactively without writing curl commands.

---

## 🧪 Running Automated Tests

A comprehensive integration test suite is included that exercises all 11 core and bonus requirements (account creation, balance integrity, debit overdraft protection, duplicate reference rejection, history pagination & sorting, and bonus money transfer):

```bash
npm test
```

---

## 📖 Quick API Walkthrough

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. Create Account
```bash
curl -X POST http://localhost:3000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Smith"}'
```
*Response:*
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": "c1352e07-3d18-403d-bc67-3315a6396f60",
    "name": "Alice Smith",
    "balance": 0,
    "created_at": "2026-10-27T09:30:00.000Z"
  }
}
```

### 3. Credit Account
```bash
curl -X POST http://localhost:3000/api/v1/accounts/<ACCOUNT_ID>/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "credit",
    "amount": 100.00,
    "description": "Salary deposit",
    "reference_id": "DEP-001"
  }'
```

### 4. Debit Account
```bash
curl -X POST http://localhost:3000/api/v1/accounts/<ACCOUNT_ID>/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "debit",
    "amount": 30.00,
    "description": "Coffee & Snack",
    "reference_id": "DEB-001"
  }'
```

### 5. Fetch Balance
```bash
curl http://localhost:3000/api/v1/accounts/<ACCOUNT_ID>/balance
```

### 6. Fetch Transaction History (Paginated)
```bash
curl "http://localhost:3000/api/v1/accounts/<ACCOUNT_ID>/transactions?page=1&limit=10&type=credit"
```

### 7. Money Transfer (Bonus)
```bash
curl -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "from_account_id": "<SOURCE_ACCOUNT_ID>",
    "to_account_id": "<DEST_ACCOUNT_ID>",
    "amount": 25.00,
    "reference_id": "XFER-101",
    "description": "Dinner split"
  }'
```

For complete documentation, status codes, and error formats, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).
#   t r a n s a c t i o n - l e d g e r - a p i  
 