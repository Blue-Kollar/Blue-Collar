# Soroban Contract Integration Guide

Covers how to call the Registry and Market contracts from the Next.js app using `@stellar/stellar-sdk`.

> For complete contract function signatures, storage maps, events, and authorization rules, see [CONTRACTS.md](./CONTRACTS.md).

## Configuration

```ts
// lib/stellar.ts
import { Contract, Networks, SorobanRpc } from '@stellar/stellar-sdk';

export const NETWORK_PASSPHRASE = Networks.TESTNET; // or Networks.PUBLIC
export const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ?? 'https://soroban-testnet.stellar.org';
export const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID!;
export const MARKET_ID = process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID!;

export const server = new SorobanRpc.Server(RPC_URL);
```

## Register a Worker

```ts
import { Contract, TransactionBuilder, xdr, Address, nativeToScVal } from '@stellar/stellar-sdk';

async function registerWorker(sourceKeypair, workerId: string, name: string, category: string) {
  const account = await server.getAccount(sourceKeypair.publicKey());
  const contract = new Contract(REGISTRY_ID);

  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      contract.call(
        'register',
        nativeToScVal(workerId, { type: 'symbol' }),
        Address.fromString(sourceKeypair.publicKey()).toScVal(),
        nativeToScVal(name, { type: 'string' }),
        nativeToScVal(category, { type: 'symbol' }),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(sourceKeypair);
  return server.sendTransaction(prepared);
}
```

## Get a Worker

```ts
async function getWorker(workerId: string) {
  const contract = new Contract(REGISTRY_ID);

  const tx = new TransactionBuilder(
    await server.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'), // read-only placeholder
    { fee: '100', networkPassphrase: NETWORK_PASSPHRASE },
  )
    .addOperation(contract.call('get_worker', nativeToScVal(workerId, { type: 'symbol' })))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (!SorobanRpc.Api.isSimulationSuccess(result)) throw new Error(result.error);
  return result.result?.retval;
}
```

## Send a Tip

```ts
async function tipWorker(sourceKeypair, toAddress: string, tokenAddress: string, amount: bigint) {
  const account = await server.getAccount(sourceKeypair.publicKey());
  const contract = new Contract(MARKET_ID);

  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      contract.call(
        'tip',
        Address.fromString(sourceKeypair.publicKey()).toScVal(),
        Address.fromString(toAddress).toScVal(),
        Address.fromString(tokenAddress).toScVal(),
        nativeToScVal(amount, { type: 'i128' }),
      ),
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(sourceKeypair);
  return server.sendTransaction(prepared);
}
```

## Extend Worker TTL

```ts
async function extendWorkerTtl(sourceKeypair, workerId: string) {
  const account = await server.getAccount(sourceKeypair.publicKey());
  const contract = new Contract(REGISTRY_ID);

  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call('extend_worker_ttl', nativeToScVal(workerId, { type: 'symbol' })))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(sourceKeypair);
  return server.sendTransaction(prepared);
}
```

## Signing with Freighter

```ts
import { signTransaction } from '@stellar/freighter-api';

async function signWithFreighter(builtTx) {
  const { signedTxXdr, error } = await signTransaction(builtTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (error) throw new Error(error);
  return TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
}
```

Replace `prepared.sign(sourceKeypair)` with `const signed = await signWithFreighter(prepared)` then `server.sendTransaction(signed)`.

## Error Handling

```ts
const response = await server.sendTransaction(signed);

if (response.status === 'ERROR') {
  const resultXdr = xdr.TransactionResult.fromXDR(response.errorResult!, 'base64');
  console.error('Contract error:', resultXdr.result().results());
}

// Poll for confirmation
let get = await server.getTransaction(response.hash);
while (get.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
  await new Promise((r) => setTimeout(r, 1000));
  get = await server.getTransaction(response.hash);
}
if (get.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
  throw new Error('Transaction failed');
}
```

Common errors:

- `HostError: Error(Contract, #1)` — worker ID already registered
- `HostError: Error(Contract, #2)` — caller is not a curator
- `HostError: Error(WasmVm, ...)` — contract logic panicked; check inputs
