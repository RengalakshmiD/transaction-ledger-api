import { createApp } from '../src/app';
import { pool } from '../src/config/database';
import { runMigrations } from '../src/db/migrate';
import { Server } from 'http';

let server: Server;
let baseUrl: string;

// Helper to send HTTP requests to test server
async function request(path: string, options: RequestInit = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log('🧪 Starting Automated Integration Tests...\n');

  try {
    // 1. Initialize DB schema
    await runMigrations();

    // 2. Start server on dynamic port
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    console.log(`📡 Test server running on ${baseUrl}\n`);

    // TEST 1: Health check
    console.log('--- Test 1: Health Check ---');
    const health = await request('/health');
    if (health.status !== 200 || health.data?.status !== 'healthy') {
      throw new Error(`Health check failed: ${JSON.stringify(health)}`);
    }
    console.log('✅ Health check passed\n');

    // TEST 2: Create Account (verify initial balance is 0 and client cannot tamper)
    console.log('--- Test 2: Create Account ---');
    const createRes = await request('/api/v1/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice Smith', balance: 5000 }), // Should ignore balance: 5000
    });
    if (createRes.status !== 201 || !createRes.data?.data?.id) {
      throw new Error(`Create account failed: ${JSON.stringify(createRes)}`);
    }
    const accountA = createRes.data.data;
    if (accountA.balance !== 0) {
      throw new Error(`Account balance should be 0, but got: ${accountA.balance}`);
    }
    console.log(`✅ Account created with ID: ${accountA.id}, Initial Balance: ${accountA.balance}\n`);

    // TEST 3: Get Balance
    console.log('--- Test 3: Get Initial Balance ---');
    const balRes1 = await request(`/api/v1/accounts/${accountA.id}/balance`);
    if (balRes1.status !== 200 || balRes1.data?.data?.balance !== 0) {
      throw new Error(`Initial balance check failed: ${JSON.stringify(balRes1)}`);
    }
    console.log(`✅ Initial balance verified: ${balRes1.data.data.balance}\n`);

    // TEST 4: Credit Transaction (+100)
    console.log('--- Test 4: Credit Transaction (+100) ---');
    const creditRes = await request(`/api/v1/accounts/${accountA.id}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 100,
        description: 'Initial deposit',
        reference_id: 'REF-TX-001',
      }),
    });
    if (creditRes.status !== 201 || creditRes.data?.account_balance !== 100) {
      throw new Error(`Credit transaction failed: ${JSON.stringify(creditRes)}`);
    }
    console.log(`✅ Credit applied. New balance: ${creditRes.data.account_balance}\n`);

    // TEST 5: Debit Transaction (-30)
    console.log('--- Test 5: Debit Transaction (-30) ---');
    const debitRes = await request(`/api/v1/accounts/${accountA.id}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'debit',
        amount: 30,
        description: 'Grocery purchase',
        reference_id: 'REF-TX-002',
      }),
    });
    if (debitRes.status !== 201 || debitRes.data?.account_balance !== 70) {
      throw new Error(`Debit transaction failed: ${JSON.stringify(debitRes)}`);
    }
    console.log(`✅ Debit applied. New balance: ${debitRes.data.account_balance}\n`);

    // TEST 6: Reject Debit on Insufficient Balance (-150 on balance of 70)
    console.log('--- Test 6: Debit Rejection (Insufficient Balance) ---');
    const overDebitRes = await request(`/api/v1/accounts/${accountA.id}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'debit',
        amount: 150,
        description: 'Expensive item',
        reference_id: 'REF-TX-003',
      }),
    });
    if (overDebitRes.status !== 422) {
      throw new Error(`Expected 422 for insufficient balance, got: ${overDebitRes.status}`);
    }
    // Verify balance is still 70
    const balCheckAfterFail = await request(`/api/v1/accounts/${accountA.id}/balance`);
    if (balCheckAfterFail.data?.data?.balance !== 70) {
      throw new Error(`Balance was mutated after rejected debit! Balance: ${balCheckAfterFail.data?.data?.balance}`);
    }
    console.log(`✅ Debit rejected with 422. Balance remains safely intact at 70\n`);

    // TEST 7: Duplicate Reference ID Rejection
    console.log('--- Test 7: Duplicate reference_id Rejection ---');
    const dupRes = await request(`/api/v1/accounts/${accountA.id}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 50,
        description: 'Duplicate attempt',
        reference_id: 'REF-TX-001', // Already used in Test 4
      }),
    });
    if (dupRes.status !== 409) {
      throw new Error(`Expected 409 for duplicate reference_id, got: ${dupRes.status}`);
    }
    // Verify balance is still 70
    const balCheckAfterDup = await request(`/api/v1/accounts/${accountA.id}/balance`);
    if (balCheckAfterDup.data?.data?.balance !== 70) {
      throw new Error(`Balance was mutated after duplicate transaction! Balance: ${balCheckAfterDup.data?.data?.balance}`);
    }
    console.log(`✅ Duplicate reference_id rejected with 409 Conflict. Balance remains at 70\n`);

    // TEST 8: Same reference_id on a Different Account (Must be permitted)
    console.log('--- Test 8: Same reference_id on Different Account ---');
    const accountBRes = await request('/api/v1/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob Jones' }),
    });
    const accountB = accountBRes.data.data;

    const diffAccountTx = await request(`/api/v1/accounts/${accountB.id}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 50,
        description: 'Same reference allowed across accounts',
        reference_id: 'REF-TX-001', // Reused for Bob
      }),
    });
    if (diffAccountTx.status !== 201) {
      throw new Error(`Failed to reuse reference_id on different account: ${JSON.stringify(diffAccountTx)}`);
    }
    console.log(`✅ reference_id 'REF-TX-001' successfully processed on separate account B\n`);

    // TEST 9: Transaction History, Filtering & Pagination
    console.log('--- Test 9: Transaction History & Pagination ---');
    // Add one more credit to Account A
    await request(`/api/v1/accounts/${accountA.id}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'credit',
        amount: 25,
        description: 'Extra credit',
        reference_id: 'REF-TX-004',
      }),
    });

    const historyRes = await request(`/api/v1/accounts/${accountA.id}/transactions?page=1&limit=2`);
    if (historyRes.status !== 200) {
      throw new Error(`History fetch failed: ${JSON.stringify(historyRes)}`);
    }
    const { data: txList, pagination } = historyRes.data;
    if (txList.length !== 2 || pagination.total_records !== 3 || pagination.total_pages !== 2) {
      throw new Error(`Pagination metadata incorrect: ${JSON.stringify(pagination)}`);
    }
    // Check sorting (latest first)
    if (txList[0].reference_id !== 'REF-TX-004') {
      throw new Error(`Expected latest-first order, but got first tx reference: ${txList[0].reference_id}`);
    }

    // Filter by type: debit
    const debitHistory = await request(`/api/v1/accounts/${accountA.id}/transactions?type=debit`);
    if (debitHistory.data?.data?.length !== 1 || debitHistory.data?.data[0].type !== 'debit') {
      throw new Error(`Type filter failed: ${JSON.stringify(debitHistory)}`);
    }
    console.log(`✅ History pagination, sorting (latest first), and type filtering verified\n`);

    // TEST 10: Bonus - Inter-Account Money Transfer
    console.log('--- Test 10: Bonus - Money Transfer API ---');
    // Alice current balance: 70 + 25 = 95
    // Bob current balance: 50
    // Transfer 35 from Alice to Bob
    const transferRes = await request('/api/v1/transfers', {
      method: 'POST',
      body: JSON.stringify({
        from_account_id: accountA.id,
        to_account_id: accountB.id,
        amount: 35,
        description: 'Rent split',
        reference_id: 'XFER-001',
      }),
    });
    if (transferRes.status !== 200) {
      throw new Error(`Transfer failed: ${JSON.stringify(transferRes)}`);
    }
    if (
      transferRes.data?.data?.from_account?.new_balance !== 60 ||
      transferRes.data?.data?.to_account?.new_balance !== 85
    ) {
      throw new Error(`Transfer balances incorrect: ${JSON.stringify(transferRes)}`);
    }
    console.log(`✅ Transfer successful. Alice: 95 -> 60, Bob: 50 -> 85\n`);

    // TEST 11: Transfer Rejection on Insufficient Balance
    console.log('--- Test 11: Transfer Insufficient Balance Rejection ---');
    const badTransfer = await request('/api/v1/transfers', {
      method: 'POST',
      body: JSON.stringify({
        from_account_id: accountA.id,
        to_account_id: accountB.id,
        amount: 1000, // Alice only has 60
        reference_id: 'XFER-002',
      }),
    });
    if (badTransfer.status !== 422) {
      throw new Error(`Expected 422 for over-transfer, got: ${badTransfer.status}`);
    }
    console.log(`✅ Over-transfer rejected with 422 Unprocessable Entity\n`);

    console.log('🎉 ALL INTEGRATION TESTS PASSED PERFECTLY! 100% SPEC COMPLIANCE.\n');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await pool.end();
  }
}

runTests();
