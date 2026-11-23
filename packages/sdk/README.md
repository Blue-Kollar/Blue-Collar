# @bluecollar/sdk

Shared TypeScript SDK for Stellar / Soroban contract interaction. This is the single
source of truth for talking to the BlueCollar contracts and the Stellar network —
consumed by both `packages/api` and `packages/app` so contract-calling logic isn't
duplicated (or allowed to drift) between the backend and the frontend.

## Installation

```bash
pnpm add @bluecollar/sdk
```

If you're working inside this monorepo, add it as a workspace dependency instead:

```bash
pnpm --filter <your-package> add @bluecollar/sdk --workspace
```

The SDK depends on `@stellar/stellar-sdk`; you don't need to install it separately
unless you're building/signing transactions yourself (see the examples below).

## Quick start

```ts
import { createSdk } from '@bluecollar/sdk';

const sdk = createSdk({
  network: 'testnet',
  registryContractId: '<C...>', // optional — omit if you only need Horizon
});

const account = await sdk.horizon.getAccountInfo(publicKey);
const result = await sdk.registry?.simulateInvoke('get_worker', [workerId]);
```

`createSdk` picks the default Horizon URL for the given network
(`horizon-testnet.stellar.org` / `horizon.stellar.org`) unless you override it via
`horizonUrl`. `RegistryClient` similarly resolves the Soroban RPC endpoint
(`soroban-testnet.stellar.org` / `soroban-rpc.stellar.org`) from `network`.

## What's in here

| Export                                                                                                                           | Purpose                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `createSdk(config)`                                                                                                              | Factory that wires up a `HorizonClient` and (if a registry contract ID is passed) a `RegistryClient`          |
| `HorizonClient`                                                                                                                  | Typed wrapper around the Stellar Horizon REST API — account info, broadcasting signed transactions, tx status |
| `RegistryClient`                                                                                                                 | Typed wrapper for invoking the `registry` Soroban contract (see below)                                        |
| `SdkError`                                                                                                                       | Error type thrown by both clients, carrying an HTTP-style status code                                         |
| Types (`AccountInfo`, `SdkConfig`, `WorkerRegistration`, `ReputationSync`, `UnsignedTxParams`, `BroadcastResult`, `TxStatus`, …) | `src/types.ts`                                                                                                |

## Public method reference

### `HorizonClient`

| Method                 | Signature                                                                                        | Description                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `getAccountInfo`       | `(publicKey: string) => Promise<AccountInfo>`                                                    | Fetch account balances, sequence number, and signers from Horizon. |
| `getTransactions`      | `(publicKey: string, opts?: { limit?: number; order?: 'asc' \| 'desc' }) => Promise<TxStatus[]>` | List recent transactions for an account.                           |
| `broadcastTransaction` | `(signedXdr: string) => Promise<BroadcastResult>`                                                | Submit a signed transaction envelope (base64 XDR) to the network.  |
| `getTransactionStatus` | `(hash: string) => Promise<TxStatus>`                                                            | Look up the status of a previously submitted transaction by hash.  |

### `RegistryClient`

| Method           | Signature                                               | Description                                                       |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `simulateInvoke` | `(method: string, args: unknown[]) => Promise<unknown>` | Simulate a read-only contract call and return the decoded result. |
| `getWorker`      | `(workerId: string) => Promise<WorkerRegistration>`     | Convenience wrapper around `simulateInvoke('get_worker', …)`.     |
| `getReputation`  | `(workerId: string) => Promise<ReputationSync>`         | Convenience wrapper around `simulateInvoke('get_reputation', …)`. |

`RegistryClient.simulateInvoke` covers read-only contract calls. For writes (anything
that requires a signature — `register`, `toggle`, etc.), build and sign the transaction
with `@stellar/stellar-sdk`'s `TransactionBuilder` and submit the resulting XDR via
`HorizonClient.broadcastTransaction`; `RegistryClient`'s own envelope builder is a
placeholder for the simulate-only path (see the comment in `registry.client.ts`).

## Examples

### 1. Registry lookup via `simulateInvoke`

Read a worker's registration record from the `registry` contract without submitting a
transaction.

```ts
import { createSdk } from '@bluecollar/sdk';

const sdk = createSdk({
  network: 'testnet',
  registryContractId: process.env.REGISTRY_CONTRACT_ID!,
});

const workerId = 'worker-42';

// Generic escape hatch — pass any read-only method name and its args.
const raw = await sdk.registry!.simulateInvoke('get_worker', [workerId]);
console.log('raw result:', raw);

// Typed convenience wrapper for the same call.
const worker = await sdk.registry!.getWorker(workerId);
console.log(`${worker.id} registered:`, worker.active);
```

### 2. Horizon account info and transaction history

Fetch an account's balances and its most recent transactions.

```ts
import { createSdk } from '@bluecollar/sdk';

const sdk = createSdk({ network: 'testnet' });
const publicKey = 'G...';

const account = await sdk.horizon.getAccountInfo(publicKey);
console.log('sequence:', account.sequence);
for (const balance of account.balances) {
  console.log(`${balance.asset_type}: ${balance.balance}`);
}

const txs = await sdk.horizon.getTransactions(publicKey, { limit: 10, order: 'desc' });
for (const tx of txs) {
  console.log(tx.hash, tx.status, tx.createdAt);
}
```

### 3. Combined workflow: fund, build, broadcast, check status

Fund a testnet account via Friendbot, build an unsigned payment transaction, sign it,
broadcast it, then poll for its status.

```ts
import { createSdk } from '@bluecollar/sdk';
import { Asset, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

const sdk = createSdk({ network: 'testnet' });

// 1. Fund a fresh testnet account.
const keypair = Keypair.random();
await fetch(`https://friendbot.stellar.org?addr=${keypair.publicKey()}`);
console.log('funded:', keypair.publicKey());

// 2. Build an unsigned payment transaction.
const source = await sdk.horizon.getAccountInfo(keypair.publicKey());
const tx = new TransactionBuilder(
  {
    accountId: () => keypair.publicKey(),
    sequenceNumber: () => source.sequence,
    incrementSequenceNumber: () => {},
  } as any,
  { fee: '100', networkPassphrase: Networks.TESTNET },
)
  .addOperation(
    Operation.payment({
      destination: 'G...', // recipient
      asset: Asset.native(),
      amount: '1',
    }),
  )
  .setTimeout(30)
  .build();

// 3. Sign and broadcast.
tx.sign(keypair);
const result = await sdk.horizon.broadcastTransaction(tx.toXDR());
console.log('submitted:', result.hash);

// 4. Check status.
const status = await sdk.horizon.getTransactionStatus(result.hash);
console.log('status:', status.status);
```

> **Note:** the `TransactionBuilder` account stub above is illustrative — in real code
> pass the `Account` object returned by `@stellar/stellar-sdk`'s `server.loadAccount`
> or construct one from `getAccountInfo`'s sequence number.

## Error handling

Both clients throw `SdkError` on failure. It carries an HTTP-style `status` code and a
`message`, so you can branch on the failure class:

```ts
import { createSdk, SdkError } from '@bluecollar/sdk';

const sdk = createSdk({ network: 'testnet' });

try {
  await sdk.horizon.getAccountInfo('G...');
} catch (err) {
  if (err instanceof SdkError) {
    if (err.status === 404) {
      console.error('account not found — has it been funded?');
    } else if (err.status >= 500) {
      console.error('Horizon is having trouble, retry later');
    } else {
      console.error(`SDK error ${err.status}: ${err.message}`);
    }
  } else {
    throw err;
  }
}
```

## Network configuration

`createSdk` accepts a `network` of `'testnet'` or `'mainnet'` (public). Defaults:

| Network   | Horizon URL                           | Soroban RPC URL                       |
| --------- | ------------------------------------- | ------------------------------------- |
| `testnet` | `https://horizon-testnet.stellar.org` | `https://soroban-testnet.stellar.org` |
| `mainnet` | `https://horizon.stellar.org`         | `https://soroban-rpc.stellar.org`     |

Override either endpoint explicitly:

```ts
const sdk = createSdk({
  network: 'testnet',
  horizonUrl: 'https://my-horizon-proxy.example.com',
  sorobanRpcUrl: 'https://my-soroban-proxy.example.com',
  registryContractId: '<C...>',
});
```

## Contract interface reference

This SDK only wraps a subset of one contract's interface (`registry`, read-only calls).
For the full public interface of every contract — including `market`, `dispute`,
`fee_distribution`, and `insurance_pool`, which this SDK does not yet wrap — see:

- **[docs/CONTRACTS.md](../../docs/CONTRACTS.md)** — function signatures, storage maps,
  events, and auth requirements for every contract.
- **[packages/contracts/VERSIONING.md](../contracts/VERSIONING.md)** — how contract
  interfaces are versioned; read this before depending on a specific function signature,
  since a breaking on-chain change requires this SDK to be updated in lockstep.
- **[packages/contracts/README.md](../contracts/README.md)** — build/deploy/upgrade
  instructions for the contracts themselves.

## Architecture & Package Boundaries

- **[ADR 0001: Monorepo Package Boundaries](../../docs/adr/0001-monorepo-package-boundaries.md)** — defines why `packages/sdk` is separated from `packages/types`, allowed dependency directions, and Stellar client responsibilities.
- **[ADR index](../../docs/adr/README.md)** — all architecture decision records for the monorepo.

## Testing

```bash
pnpm --filter @bluecollar/sdk test
```
