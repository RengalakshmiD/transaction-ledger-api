# API Documentation — Transaction Ledger API

**Base URL**: `http://localhost:3000`  
**API Version**: `v1`  
**Content-Type**: `application/json`

---

## 📋 Standard Response Formats

### Success Response Envelope
```json
{
  "success": true,
  "message": "Optional human-readable confirmation",
  "data": { ... }
}
```

### Error Response Envelope
All error responses adhere to a consistent contract across all endpoints:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable explanation of what went wrong",
    "details": [ ... ]
  }
}
```

### Common HTTP Status Codes
| Status Code | Meaning | Example Scenario |
| :--- | :--- | :--- |
| **`200 OK`** | Request succeeded | Account balance fetched, transaction history returned, transfer executed |
| **`201 Created`** | Resource successfully created | Account or Transaction successfully created |
| **`400 Bad Request`** | Input validation failed | Missing name, amount $\le 0$, invalid UUID, or transferring to same account |
| **`404 Not Found`** | Resource not found | Account ID does not exist |
| **`409 Conflict`** | Duplicate resource | Reusing a `reference_id` on the same account |
| **`422 Unprocessable Entity`** | Business rule violation | Debit amount exceeds account balance |
| **`500 Internal Server Error`** | Uncaught server issue | Database failure or unhandled exception |

---

## 🚀 Endpoints

### 1. Health Check

Checks API server uptime and liveness.

- **Method**: `GET`
- **Path**: `/health`

#### Response (`200 OK`)
```json
{
  "status": "healthy",
  "timestamp": "2026-10-27T09:30:00.000Z",
  "service": "Transaction Ledger API"
}
```

---

### 2. List All Accounts

Retrieves all created accounts in the ledger. Ideal for browser inspection and copying account IDs.

- **Method**: `GET`
- **Path**: `/api/v1/accounts`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "819da98d-e590-4aee-8dae-5892b14ce874",
      "name": "Alice Smith",
      "balance": 60,
      "created_at": "2026-10-27T10:07:49.531Z"
    }
  ]
}
```

---

### 3. Create Account

Creates a new account in the ledger. Initial balance is strictly set to `0.00`. Any attempt by the client to supply an initial balance is disregarded.

- **Method**: `POST`
- **Path**: `/api/v1/accounts`
- **Headers**: `Content-Type: application/json`

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | **Yes** | Account holder name (1 to 255 characters) |

#### Example Request
```bash
curl -X POST http://localhost:3000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe"
  }'
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": "e304f580-0a25-4c07-ba71-6c12ce483754",
    "name": "Jane Doe",
    "balance": 0,
    "created_at": "2026-10-27T09:31:15.120Z"
  }
}
```

#### Error Responses
- **`400 Bad Request`**: Name missing or empty string.
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed for incoming request",
      "details": [
        { "field": "name", "message": "Account name cannot be empty" }
      ]
    }
  }
  ```

---

### 3. Get Account Balance

Fetches the current real-time balance of an existing account.

- **Method**: `GET`
- **Path**: `/api/v1/accounts/:accountId/balance`

#### Path Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `accountId` | UUID string | **Yes** | Unique identifier of the account |

#### Example Request
```bash
curl http://localhost:3000/api/v1/accounts/e304f580-0a25-4c07-ba71-6c12ce483754/balance
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "account_id": "e304f580-0a25-4c07-ba71-6c12ce483754",
    "balance": 150.50
  }
}
```

#### Error Responses
- **`404 Not Found`**: Account does not exist.
  ```json
  {
    "success": false,
    "error": {
      "code": "ACCOUNT_NOT_FOUND",
      "message": "Account with ID 'e304f580-0a25-4c07-ba71-6c12ce483754' does not exist."
    }
  }
  ```
- **`400 Bad Request`**: Invalid UUID path parameter.

---

### 4. Add Transaction

Appends an immutable credit or debit transaction to an account and atomically updates the account balance.

- **Method**: `POST`
- **Path**: `/api/v1/accounts/:accountId/transactions`
- **Headers**: `Content-Type: application/json`

#### Path Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `accountId` | UUID string | **Yes** | Target account UUID |

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | string | **Yes** | Must be either `"credit"` or `"debit"` |
| `amount` | number | **Yes** | Positive number with up to 2 decimal places ($> 0$) |
| `reference_id` | string | **Yes** | Unique reference string within this account |
| `description` | string | No | Optional notes about the transaction |

#### Example Request: Credit
```bash
curl -X POST http://localhost:3000/api/v1/accounts/e304f580-0a25-4c07-ba71-6c12ce483754/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "credit",
    "amount": 100.00,
    "reference_id": "REF-DEP-001",
    "description": "Initial bank deposit"
  }'
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "message": "Transaction processed successfully",
  "data": {
    "id": "1d8b7461-9c60-4966-9bb2-0b81ea199462",
    "account_id": "e304f580-0a25-4c07-ba71-6c12ce483754",
    "type": "credit",
    "amount": 100,
    "description": "Initial bank deposit",
    "reference_id": "REF-DEP-001",
    "created_at": "2026-10-27T09:35:00.000Z"
  },
  "account_balance": 100
}
```

#### Error Responses
- **`422 Unprocessable Entity`**: Insufficient balance during a debit transaction.
  ```json
  {
    "success": false,
    "error": {
      "code": "INSUFFICIENT_BALANCE",
      "message": "Insufficient funds. Current balance is 70.00, but tried to debit 150.00."
    }
  }
  ```
- **`409 Conflict`**: Duplicate `reference_id` submitted for the same account.
  ```json
  {
    "success": false,
    "error": {
      "code": "DUPLICATE_TRANSACTION",
      "message": "Transaction with reference_id 'REF-DEP-001' already exists for account 'e304f580-0a25-4c07-ba71-6c12ce483754'."
    }
  }
  ```
- **`404 Not Found`**: Target account does not exist.
- **`400 Bad Request`**: Validation error (invalid amount, negative amount, missing reference ID, invalid transaction type).

---

### 5. Get Transaction History

Retrieves all transactions for an account with sorting (latest-first), type filtering, and pagination.

- **Method**: `GET`
- **Path**: `/api/v1/accounts/:accountId/transactions`

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `type` | string | No | All | Filter by `"credit"` or `"debit"` |
| `page` | integer | No | `1` | Page number ($\ge 1$) |
| `limit` | integer | No | `10` | Page size ($1 \le limit \le 100$) |

#### Example Request
```bash
curl "http://localhost:3000/api/v1/accounts/e304f580-0a25-4c07-ba71-6c12ce483754/transactions?page=1&limit=5&type=credit"
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "1d8b7461-9c60-4966-9bb2-0b81ea199462",
      "account_id": "e304f580-0a25-4c07-ba71-6c12ce483754",
      "type": "credit",
      "amount": 100,
      "description": "Initial bank deposit",
      "reference_id": "REF-DEP-001",
      "created_at": "2026-10-27T09:35:00.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "page_size": 5,
    "total_records": 1,
    "total_pages": 1
  }
}
```

---

### 6. Money Transfer (Bonus)

Atomically transfers money from a source account to a destination account.
- Creates a `debit` transaction on the source account.
- Creates a `credit` transaction on the destination account.
- Updates both account balances atomically.
- If any check fails, the entire transaction rolls back.

- **Method**: `POST`
- **Path**: `/api/v1/transfers`
- **Headers**: `Content-Type: application/json`

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `from_account_id` | UUID | **Yes** | Source account ID |
| `to_account_id` | UUID | **Yes** | Destination account ID (must differ from source) |
| `amount` | number | **Yes** | Amount to transfer ($> 0$) |
| `reference_id` | string | **Yes** | Unique transfer reference ID |
| `description` | string | No | Optional transfer note |

#### Example Request
```bash
curl -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "from_account_id": "e304f580-0a25-4c07-ba71-6c12ce483754",
    "to_account_id": "b785d033-6cfc-4022-8616-fc0572b83445",
    "amount": 40.00,
    "reference_id": "XFER-9921",
    "description": "Dinner split"
  }'
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Funds transferred successfully",
  "data": {
    "reference_id": "XFER-9921",
    "amount": 40,
    "from_account": {
      "id": "e304f580-0a25-4c07-ba71-6c12ce483754",
      "previous_balance": 100,
      "new_balance": 60,
      "transaction_id": "a98a0c21-cfcf-4835-97b7-e23a315998a1"
    },
    "to_account": {
      "id": "b785d033-6cfc-4022-8616-fc0572b83445",
      "previous_balance": 50,
      "new_balance": 90,
      "transaction_id": "42bfb373-cff9-497d-aa51-3ae0eaae0f09"
    }
  }
}
```

#### Error Responses
- **`400 Bad Request`**: Source and destination account IDs are identical, or negative/zero amount.
- **`404 Not Found`**: Either source or destination account does not exist.
- **`422 Unprocessable Entity`**: Source account has insufficient funds.
- **`409 Conflict`**: Transfer with this `reference_id` was already executed.
