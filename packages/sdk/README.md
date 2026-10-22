# @bluecollar/sdk

Shared TypeScript SDK for Stellar / Soroban contract interaction. This is the single
source of truth for talking to the BlueCollar contracts and the Stellar network —
consumed by both `packages/api` and `packages/app` so contract-calling logic isn't
duplicated (or allowed to drift) between the backend and the frontend.

## What's in here

| Export | Purpose |
|---|---|
| `createSdk(config)` | Factory that wires up a `HorizonClient` and (if a registry contract ID is passed) a `RegistryClient` |
| `HorizonClient` | Typed wrapper around the Stellar Horizon REST API — account info, broadcasting signed transactions, tx status |
| `RegistryClient` | Typed wrapper for invoking the `registry` Soroban contract (see below) |
| `SdkError` | Error type thrown by both clients, carrying an HTTP-style status code |
| Types (`AccountInfo`, `SdkConfig`, `WorkerRegistration`, `ReputationSync`, `UnsignedTxParams`, `BroadcastResult`, `TxStatus`, …) | `src/types.ts` |

## Usage

```ts
import { createSdk } from '@bluecollar/sdk'

const sdk = createSdk({
  network: 'testnet',
  registryContractId: '<C...>', // optional — omit if you only need Horizon
})

const account = await sdk.horizon.getAccountInfo(publicKey)
const result = await sdk.registry?.simulateInvoke('get_worker', [workerId])
```

`createSdk` picks the default Horizon URL for the given network
(`horizon-testnet.stellar.org` / `horizon.stellar.org`) unless you override it via
`horizonUrl`. `RegistryClient` similarly resolves the Soroban RPC endpoint
(`soroban-testnet.stellar.org` / `soroban-rpc.stellar.org`) from `network`.

`RegistryClient.simulateInvoke` covers read-only contract calls. For writes (anything
that requires a signature — `register`, `toggle`, etc.), build and sign the transaction
with `@stellar/stellar-sdk`'s `TransactionBuilder` and submit the resulting XDR via
`HorizonClient.broadcastTransaction`; `RegistryClient`'s own envelope builder is a
placeholder for the simulate-only path (see the comment in `registry.client.ts`).

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

## Testing

```bash
pnpm --filter @bluecollar/sdk test
```
