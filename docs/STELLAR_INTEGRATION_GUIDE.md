# Stellar Integration Implementation Guide

## Overview

This guide documents the implementation of two core backend features:

- **Issue #751**: On-Chain Event Indexer Service
- **Issue #752**: Wallet Integration Service

## Architecture

### Issue #751: Event Indexer Service

#### Purpose

Ingest Soroban contract events from Stellar Horizon RPC into PostgreSQL for fast querying and analytics without requiring live Horizon calls for every query.

#### Components

- **ContractEvent** (Prisma model): Stores indexed contract events
  - Unique constraint on `(contractId, ledger, txIndex, eventIndex)` prevents duplicates
  - Indexed by `contractId`, `ledger`, `eventName`, `createdAt` for fast queries

- **EventIndexerCursor** (Prisma model): Tracks ingestion progress per contract
  - Survives service restarts — no events are missed
  - Updated atomically after processing batch

- **indexer.service.ts**: Core service module
  - `ingestContractEvent()` — Idempotent event storage
  - `getOrCreateCursor()` — Cursor initialization
  - `updateCursor()` — Safe cursor advancement
  - `queryEvents()` — REST query endpoint
  - `reconcileEvents()` — On-startup reconciliation

- **horizon-poller.service.ts**: Enhanced polling worker
  - Polls Horizon every 30s for new events
  - Uses database cursor instead of in-memory state
  - Calls `indexerService.ingestContractEvent()` for each event
  - Publishes to webhooks for real-time subscribers

#### Event Flow

```
Stellar Network (Contract emits event)
    ↓
Horizon RPC (polls every 30s)
    ↓
horizon-poller.service.ts (fetches batch of 100 events)
    ↓
indexer.service.ts (ingestContractEvent → upsert to DB)
    ↓
ContractEvent table (indexed, queryable, survives restarts)
    ↓
/api/events (REST endpoint for apps)
```

#### Usage

**Query indexed events:**

```bash
curl "http://localhost:3000/api/events?contractId=CBQHLSNW...&limit=50&offset=0"
```

**Get worker registrations by owner:**

```bash
curl "http://localhost:3000/api/events/worker-registrations/CBQHLSNW.../GAQFH4..."
```

**Get cursor position:**

```bash
curl "http://localhost:3000/api/events/cursor/CBQHLSNW..."
```

### Issue #752: Wallet Integration Service

#### Purpose

Provide backend helpers for Stellar account operations: balance inquiry, transaction building/signing, broadcasting, and testnet funding.

#### Components

- **StellarAccount** (Prisma model): Links Stellar wallets to users
  - One-to-many: User has multiple StellarAccounts
  - Stores `publicKey`, `balance`, `sequences` for quick queries
  - `lastSyncedAt` tracks when balance was last refreshed

- **wallet.service.ts**: Core service module
  - `getAccountInfo()` — Fetch balance/sequence from Horizon
  - `linkStellarAccount()` — Register user's wallet
  - `getUserBalance()` — Get cached balance
  - `buildUnsignedTx()` — Prepare transaction for signing
  - `broadcastTransaction()` — Submit signed XDR
  - `pollTransactionStatus()` — Check tx status
  - `fundTestnetAccount()` — Friendbot funding
  - `getAccountTransactions()` — Tx history

- **wallet.ts** (Controller): HTTP handlers
  - `GET /api/wallet/balance` — Get user's balance
  - `GET /api/wallet/account/:publicKey` — Get account info
  - `POST /api/wallet/link` — Link wallet
  - `POST /api/wallet/build-tx` — Build unsigned tx
  - `POST /api/wallet/broadcast` — Broadcast tx
  - `GET /api/wallet/tx-status/:txHash` — Poll status
  - `POST /api/wallet/testnet-fund` — Fund testnet
  - `GET /api/wallet/transactions/:publicKey` — Get tx history

#### Workflows

**1. User links wallet:**

```typescript
// Frontend gets public key from Freighter
const publicKey = 'GAQFH4...'

// Call backend
POST /api/wallet/link
{ "publicKey": "GAQFH4..." }

// Backend:
// 1. Verifies account exists on Stellar network
// 2. Checks not already linked to another user
// 3. Syncs balance and sequence from Horizon
// 4. Stores in StellarAccount table
```

**2. Send tip (payment flow):**

```typescript
// Frontend: Get unsigned transaction
POST /api/wallet/build-tx
{
  "sourcePublicKey": "GAQFH4...",
  "destinationPublicKey": "GBL4...",
  "amount": "10.00",
  "memo": "tip-worker-123"
}

// Response: Transaction parameters (sequence, routing info)
{
  "sourcePublicKey": "GAQFH4...",
  "destinationPublicKey": "GBL4...",
  "amount": "10.00",
  "sequence": "12345678"
}

// Frontend: Build and sign XDR using stellar-sdk
import { TransactionBuilder, Keypair, networks } from 'stellar-sdk'
const keypair = Keypair.fromPublicKey(publicKey) // Freighter signs
const tx = new TransactionBuilder(account, { fee: 100, networkPassphrase: networks.TESTNET_NETWORK_PASSPHRASE })
  .addOperation(Operation.payment({ destination, amount, asset: Asset.native() }))
  .setTimeout(30)
  .build()
const envelope = tx.toEnvelope()
const signed = keypair.sign(envelope) // Freighter signs
const xdr = signed.toXDR()

// Frontend: Broadcast signed transaction
POST /api/wallet/broadcast
{ "signedXdr": "<base64-xdr>" }

// Response:
{ "txHash": "abc123...", "txId": "xyz..." }

// Frontend: Poll status
GET /api/wallet/tx-status/abc123...

// Poll until confirmed
{ "status": "confirmed", "resultCode": "tx_success" }
```

**3. Fund testnet account:**

```bash
curl -X POST http://localhost:3000/api/wallet/testnet-fund \
  -H "Content-Type: application/json" \
  -d '{"publicKey": "GAQFH4..."}'

# Response: { "txHash": "def456...", "message": "Account funded successfully" }
```

## Database Schema

### ContractEvent

```sql
CREATE TABLE "ContractEvent" (
    id            TEXT PRIMARY KEY,
    contractId    TEXT NOT NULL,
    eventName     TEXT NOT NULL,
    ledger        BIGINT NOT NULL,
    txIndex       INTEGER NOT NULL,
    eventIndex    INTEGER NOT NULL,
    indexed       JSONB NOT NULL,        -- e.g. ["owner": "GAQFH4..."]
    data          JSONB,                  -- additional payload
    processedAt   TIMESTAMP DEFAULT NOW(),
    createdAt     TIMESTAMP DEFAULT NOW(),

    UNIQUE(contractId, ledger, txIndex, eventIndex)
);

CREATE INDEX idx_event_contractId ON "ContractEvent"(contractId);
CREATE INDEX idx_event_ledger ON "ContractEvent"(ledger);
CREATE INDEX idx_event_name ON "ContractEvent"(eventName);
CREATE INDEX idx_event_created ON "ContractEvent"(createdAt);
```

### EventIndexerCursor

```sql
CREATE TABLE "EventIndexerCursor" (
    id         TEXT PRIMARY KEY,
    contractId TEXT NOT NULL UNIQUE,
    ledger     BIGINT NOT NULL DEFAULT 0,
    txIndex    INTEGER NOT NULL DEFAULT 0,
    updatedAt  TIMESTAMP
);
```

### StellarAccount

```sql
CREATE TABLE "StellarAccount" (
    id           TEXT PRIMARY KEY,
    publicKey    TEXT NOT NULL UNIQUE,
    userId       TEXT NOT NULL,
    balance      DOUBLE PRECISION DEFAULT 0,
    sequences    BIGINT DEFAULT 0,
    lastSyncedAt TIMESTAMP,
    createdAt    TIMESTAMP DEFAULT NOW(),
    updatedAt    TIMESTAMP,

    FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX idx_stellar_userId ON "StellarAccount"(userId);
```

## API Reference

### Event Indexer Endpoints

#### Query Events

```
GET /api/events?contractId=...&eventName=...&limit=50&offset=0
```

Response:

```json
{
  "status": "success",
  "code": 200,
  "data": {
    "events": [
      {
        "id": "...",
        "contractId": "CBQHLSNW...",
        "eventName": "WrkReg",
        "ledger": 47583982,
        "txIndex": 1,
        "eventIndex": 0,
        "indexed": { "topic": ["register"] },
        "data": { "owner": "GAQFH4..." },
        "createdAt": "2026-06-27T..."
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

### Wallet Endpoints

#### Get Balance (Protected)

```
GET /api/wallet/balance
Authorization: Bearer <jwt>
```

#### Link Wallet (Protected)

```
POST /api/wallet/link
Authorization: Bearer <jwt>
Content-Type: application/json

{ "publicKey": "GAQFH4..." }
```

#### Build Unsigned Transaction (Protected)

```
POST /api/wallet/build-tx
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "sourcePublicKey": "GAQFH4...",
  "destinationPublicKey": "GBL4...",
  "amount": "10.00",
  "memo": "optional-memo"
}
```

#### Broadcast Transaction (Protected)

```
POST /api/wallet/broadcast
Authorization: Bearer <jwt>
Content-Type: application/json

{ "signedXdr": "<base64>" }
```

## Configuration

Environment variables in `.env`:

```bash
# Stellar
HORIZON_URL="https://horizon-testnet.stellar.org"
REGISTRY_CONTRACT_ID="CBQHLSNW..."
MARKET_CONTRACT_ID="CABC..."
```

## Testing

### Manual Testing

**1. Query events:**

```bash
curl http://localhost:3000/api/events?contractId=CBQHLSNW...
```

**2. Fund testnet account:**

```bash
curl -X POST http://localhost:3000/api/wallet/testnet-fund \
  -H "Content-Type: application/json" \
  -d '{"publicKey": "GAQFH4..."}'
```

**3. Link wallet (requires auth):**

```bash
curl -X POST http://localhost:3000/api/wallet/link \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"publicKey": "GAQFH4..."}'
```

## Troubleshooting

### Events not being indexed

1. Check `HORIZON_URL` and contract IDs are set correctly
2. Verify `horizon-poller.service` is running (started in `index.ts`)
3. Check logs for Horizon connection errors
4. Confirm contracts are emitting events

### Transaction broadcast fails

1. Verify XDR is properly signed by the source account
2. Check account has sufficient XLM for fees
3. Confirm destination account exists or use `CREATE_ACCOUNT` op
4. Check sequence number is correct (one higher than current)

### Balance not updating

1. Call `GET /api/wallet/balance` to get cached value
2. Call `GET /api/wallet/account/:publicKey` to refresh from Horizon
3. Check `lastSyncedAt` to see when last synced

## Future Enhancements

- [ ] Subscribe to WebSocket events instead of polling Horizon
- [ ] Multi-signature transaction support
- [ ] Fee estimation and optimization
- [ ] Contract-specific event types and parsing
- [ ] Event replay for backfilling
- [ ] Rate limiting on Horizon API calls
