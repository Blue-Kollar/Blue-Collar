# Stellar Wallet Integration Guide

This guide covers how BlueCollar integrates Stellar wallets for on-chain payments, how to extend support beyond Freighter, the transaction signing flow, error handling, and testnet vs mainnet considerations.

## Freighter Integration Patterns

[Freighter](https://www.freighter.app) is the primary wallet supported. It is a browser extension that exposes the `@stellar/freighter-api` package.

### WalletContext

`packages/app/src/context/WalletContext.tsx` manages the global wallet state using React context. It persists the connected address to `localStorage` under the key `bc_wallet_address` and restores it on page load.

```typescript
import { WalletProvider } from '@/context/WalletContext'

// Wrap your app (already done in the root layout)
<WalletProvider>
  {children}
</WalletProvider>
```

Consuming the context:

```typescript
import { useWallet } from '@/context/WalletContext'

function MyComponent() {
  const { publicKey, network, isConnected, isConnecting, connect, disconnect } = useWallet()

  return isConnected
    ? <p>Connected: {publicKey}</p>
    : <button onClick={connect}>Connect Wallet</button>
}
```

### useWallet Hook

`packages/app/src/hooks/useWallet.ts` is a lightweight standalone hook for components that only need the wallet address without the full context:

```typescript
import { useWallet } from '@/hooks/useWallet';

const { address, connecting, connect } = useWallet();
```

### Freighter API Methods Used

| Method                                        | Purpose                                             |
| --------------------------------------------- | --------------------------------------------------- |
| `isConnected()`                               | Check if the Freighter extension is installed       |
| `requestAccess()`                             | Prompt the user to grant access to their public key |
| `getAddress()`                                | Retrieve the user's active public key               |
| `getNetwork()`                                | Get the current network (testnet / mainnet)         |
| `signTransaction(xdr, { networkPassphrase })` | Sign a transaction XDR                              |

### TipModal Transaction Flow

`packages/app/src/components/TipModal.tsx` implements the full end-to-end flow for sending XLM tips:

1. Check Freighter is installed via `isConnected()`
2. Request wallet access via `requestAccess()`
3. Get the sender's public key via `getAddress()`
4. Build a native XLM payment transaction using `@stellar/stellar-sdk`
5. Sign the XDR with `signTransaction(xdr, { networkPassphrase })`
6. Submit the signed transaction to Horizon via `POST /transactions`
7. Display the transaction hash with a link to Stellar Expert

```typescript
import { isConnected, requestAccess, getAddress, signTransaction } from '@stellar/freighter-api';

// 1. Check extension
const { isConnected: connected } = await isConnected();
if (!connected) {
  // Prompt user to install Freighter
  window.open('https://www.freighter.app', '_blank');
  return;
}

// 2–3. Request access and get address
await requestAccess();
const { address: senderAddress } = await getAddress();

// 4. Build transaction XDR (see buildTipTxXdr in TipModal.tsx)

// 5. Sign
const { signedTxXdr } = await signTransaction(txXdr, {
  networkPassphrase: 'Test SDF Network ; September 2015',
});

// 6. Submit to Horizon
const res = await fetch('https://horizon-testnet.stellar.org/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `tx=${encodeURIComponent(signedTxXdr)}`,
});
```

## Adding Other Stellar Wallets

The wallet integration is abstracted behind a common interface. To add a new wallet, implement the same connect/sign interface used by Freighter.

### Wallet Interface

Define a common interface that any wallet adapter must satisfy:

```typescript
// packages/app/src/lib/walletAdapter.ts

export interface WalletAdapter {
  /** Returns true if the wallet extension/app is available */
  isAvailable(): Promise<boolean>;
  /** Prompt the user to connect and return their public key */
  connect(): Promise<string>;
  /** Return the current network name */
  getNetwork(): Promise<string>;
  /** Sign a transaction XDR and return the signed XDR */
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
}
```

### Freighter Adapter (reference implementation)

```typescript
import {
  isConnected,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
} from '@stellar/freighter-api';

export const freighterAdapter: WalletAdapter = {
  async isAvailable() {
    const { isConnected: connected } = await isConnected();
    return connected;
  },
  async connect() {
    await requestAccess();
    const { address } = await getAddress();
    return address;
  },
  async getNetwork() {
    const { network } = await getNetwork();
    return network;
  },
  async signTransaction(xdr, networkPassphrase) {
    const { signedTxXdr } = await signTransaction(xdr, { networkPassphrase });
    return signedTxXdr;
  },
};
```

### xBull Wallet Adapter (example)

[xBull](https://xbull.app) exposes a similar browser extension API:

```typescript
// Install: npm install @creit.tech/xbull-wallet-connect
import { xBullWalletConnect } from '@creit.tech/xbull-wallet-connect';

export const xBullAdapter: WalletAdapter = {
  async isAvailable() {
    return typeof window !== 'undefined' && !!window.xBullSDK;
  },
  async connect() {
    const xbull = new xBullWalletConnect();
    const { publicKey } = await xbull.connect();
    return publicKey;
  },
  async getNetwork() {
    return 'TESTNET'; // xBull exposes network via its SDK
  },
  async signTransaction(xdr, networkPassphrase) {
    const xbull = new xBullWalletConnect();
    const { signedXDR } = await xbull.sign({ xdr, networkPassphrase });
    return signedXDR;
  },
};
```

### Lobstr Wallet (WalletConnect-based)

Lobstr supports WalletConnect for mobile wallet connections:

```typescript
// Uses the Stellar WalletConnect kit
// Install: npm install @creit.tech/stellar-wallets-kit
import { StellarWalletsKit, WalletNetwork, LOBSTR_ID } from '@creit.tech/stellar-wallets-kit';

const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: LOBSTR_ID,
});

export const lobstrAdapter: WalletAdapter = {
  async isAvailable() {
    return true;
  }, // WalletConnect works on any device
  async connect() {
    await kit.openModal({ onWalletSelected: (option) => kit.setWallet(option.id) });
    const { address } = await kit.getAddress();
    return address;
  },
  async getNetwork() {
    return 'TESTNET';
  },
  async signTransaction(xdr, networkPassphrase) {
    const { signedTxXdr } = await kit.signTransaction(xdr, { networkPassphrase });
    return signedTxXdr;
  },
};
```

## Transaction Signing Flow

All on-chain payments follow this sequence:

```
User clicks "Send Tip"
        │
        ▼
Check wallet available (isConnected / isAvailable)
        │
        ├─ No ──► Show install prompt / redirect
        │
        ▼
Request wallet access (requestAccess / connect)
        │
        ▼
Get sender public key (getAddress)
        │
        ▼
Load sender account from Horizon (server.loadAccount)
        │
        ▼
Build transaction (TransactionBuilder + Operation.payment)
        │
        ▼
Sign transaction XDR (signTransaction)
        │
        ▼
Submit to Horizon (POST /transactions)
        │
        ├─ Error ──► Parse result_codes, show error message
        │
        ▼
Display transaction hash + Stellar Expert link
```

### Building a Transaction

```typescript
import * as StellarSdk from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

async function buildPaymentTx(from: string, to: string, amountXlm: number) {
  const server = new StellarSdk.Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(from);

  return new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: to,
        asset: StellarSdk.Asset.native(),
        amount: amountXlm.toFixed(7),
      }),
    )
    .setTimeout(180)
    .build()
    .toXDR();
}
```

## Error Handling for Wallet Operations

### Common Errors and How to Handle Them

| Error Scenario          | Detection                                        | Recommended Response                           |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------- |
| Freighter not installed | `isConnected()` returns `{ isConnected: false }` | Show install prompt with link to freighter.app |
| User rejected access    | `requestAccess()` throws                         | Show "Access denied" message, allow retry      |
| User rejected signing   | `signTransaction()` throws                       | Show "Signing cancelled" message               |
| Insufficient balance    | Horizon returns `op_underfunded`                 | Show "Insufficient XLM balance"                |
| Destination not found   | Horizon returns `op_no_destination`              | Show "Recipient account not found"             |
| Network mismatch        | `getNetwork()` returns wrong network             | Warn user to switch to the correct network     |

### Error Handling Pattern

```typescript
type TxStatus = 'idle' | 'pending' | 'success' | 'error';

async function sendPayment(to: string, amount: number) {
  try {
    const { isConnected: connected } = await isConnected();
    if (!connected) throw new Error('WALLET_NOT_INSTALLED');

    await requestAccess();
    const { address: from } = await getAddress();
    const xdr = await buildPaymentTx(from, to, amount);
    const { signedTxXdr } = await signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE });

    const res = await fetch(`${HORIZON_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `tx=${encodeURIComponent(signedTxXdr)}`,
    });

    const json = await res.json();
    if (!res.ok) {
      const code =
        json.extras?.result_codes?.operations?.[0] ?? json.extras?.result_codes?.transaction;
      throw new Error(code ?? 'SUBMISSION_FAILED');
    }

    return json.hash;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
    switch (message) {
      case 'WALLET_NOT_INSTALLED':
        // Show install prompt
        break;
      case 'op_underfunded':
        // Show balance error
        break;
      case 'op_no_destination':
        // Show destination error
        break;
      default:
      // Show generic error
    }
    throw err;
  }
}
```

### Backend: On-Chain Registration Errors

The API endpoint `POST /api/workers/:id/register-on-chain` (handled by `packages/api/src/controllers/stellar.ts`) validates that `contractId` is present and returns structured errors:

```typescript
// 400 — missing contractId
{ status: 'error', message: 'contractId is required', code: 400 }

// 404 — worker not found
{ status: 'error', message: 'Worker not found', code: 404 }
```

## Testnet vs Mainnet Considerations

### Current Configuration

The app is currently configured for **Stellar Testnet**:

| Setting            | Testnet Value                                |
| ------------------ | -------------------------------------------- |
| Network passphrase | `Test SDF Network ; September 2015`          |
| Horizon URL        | `https://horizon-testnet.stellar.org`        |
| Soroban RPC        | `https://soroban-testnet.stellar.org`        |
| Explorer           | `https://stellar.expert/explorer/testnet/tx` |

### Switching to Mainnet

To target mainnet, update the constants in `TipModal.tsx` and `WalletContext.tsx`:

```typescript
// Mainnet values
const NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const HORIZON_URL = 'https://horizon.stellar.org';
const SOROBAN_RPC = 'https://soroban-rpc.stellar.org';
const EXPLORER_BASE = 'https://stellar.expert/explorer/public/tx';
```

Move these to environment variables so they can be configured per deployment:

```env
# packages/app/.env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

### Getting Testnet XLM (Friendbot)

The `TestnetFaucetButton` component (`packages/app/src/components/TestnetFaucetButton.tsx`) provides a UI button to fund testnet accounts via Friendbot. You can also fund accounts directly:

```bash
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

### Network Validation

Always verify the user's wallet is on the expected network before building transactions:

```typescript
const { network } = await getNetwork();
const expectedNetwork =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'PUBLIC' : 'TESTNET';

if (network !== expectedNetwork) {
  throw new Error(`Please switch your wallet to ${expectedNetwork}`);
}
```

### Contract Deployment

Soroban contracts must be deployed separately on testnet and mainnet. Store contract IDs in environment variables:

```env
# Testnet
NEXT_PUBLIC_MARKET_CONTRACT_ID=C...testnet_contract_id

# Mainnet (set in production environment)
NEXT_PUBLIC_MARKET_CONTRACT_ID=C...mainnet_contract_id
```

---

## Contributing a New Wallet Adapter

This section walks through the full process of adding a new Stellar wallet to BlueCollar.

### 1. Understand the Adapter Interface

Every wallet must implement the `WalletAdapter` interface in `packages/app/src/lib/walletAdapter.ts`:

```typescript
export interface WalletAdapter {
  isAvailable(): Promise<boolean>;
  connect(): Promise<string>;
  getNetwork(): Promise<string>;
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
}
```

### 2. Research the Wallet's API

Each Stellar wallet exposes a different API. Check their documentation for:

- **Installation check** — How to detect if the wallet is installed (e.g. `window` object check, SDK availability)
- **Connection** — How to request the user's public key
- **Network detection** — How to get the current network (TESTNET/PUBLIC)
- **Transaction signing** — How to sign an XDR blob

Common wallet SDKs:

| Wallet                 | Package                            | Docs                                             |
| ---------------------- | ---------------------------------- | ------------------------------------------------ |
| Freighter              | `@stellar/freighter-api`           | [docs.freighter.app](https://docs.freighter.app) |
| xBull                  | `@creit.tech/xbull-wallet-connect` | [xbull.app](https://xbull.app)                   |
| Lobstr (WalletConnect) | `@creit.tech/stellar-wallets-kit`  | [lobstr.co](https://lobstr.co)                   |
| Albedo                 | `@albedo-link/intent`              | [albedo.link](https://albedo.link)               |
| Rabet                  | `@rabeto/wallet-sdk`               | [rabet.io](https://rabet.io)                     |

### 3. Create the Adapter File

Create a new file `packages/app/src/lib/wallets/{walletName}Adapter.ts`:

```typescript
import { WalletAdapter } from '../walletAdapter';

export const albedoAdapter: WalletAdapter = {
  async isAvailable() {
    return typeof window !== 'undefined' && !!window.albedo;
  },
  async connect() {
    const res = await window.albedo.publicKey();
    return res.publicKey;
  },
  async getNetwork() {
    return 'TESTNET';
  },
  async signTransaction(xdr: string, networkPassphrase: string) {
    const res = await window.albedo.tx({ xdr, network: networkPassphrase });
    return res.signedTxXdr;
  },
};
```

### 4. Register the Adapter

Add the new adapter to the wallet selector in `packages/app/src/context/WalletContext.tsx`:

```typescript
import { freighterAdapter } from '@/lib/wallets/freighterAdapter';
import { xBullAdapter } from '@/lib/wallets/xBullAdapter';
import { lobstrAdapter } from '@/lib/wallets/lobstrAdapter';
import { albedoAdapter } from '@/lib/wallets/albedoAdapter';

const adapters: Record<string, WalletAdapter> = {
  freighter: freighterAdapter,
  xbull: xBullAdapter,
  lobstr: lobstrAdapter,
  albedo: albedoAdapter,
};
```

### 5. Update the Wallet Selector UI

If the wallet requires a UI selector (e.g., for WalletConnect-based wallets), update `packages/app/src/components/WalletSelector.tsx` to include the new option.

### 6. Test the Adapter

**Test each adapter method:**

```typescript
// Manual test in browser console
const adapter = albedoAdapter;
console.log('Available:', await adapter.isAvailable());
console.log('Address:', await adapter.connect());
console.log('Network:', await adapter.getNetwork());
```

**End-to-end payment flow:**

1. Start the app locally: `cd packages/app && pnpm dev`
2. Open `http://localhost:3001/en/workers`
3. Connect the new wallet
4. Send a tip to a test worker on testnet
5. Verify the transaction appears on [Stellar Expert (testnet)](https://stellar.expert/explorer/testnet)

### 7. Open a Pull Request

Submit a PR with title format: `feat(app): add {walletName} wallet adapter`

Include in the PR description:

- A link to the wallet's documentation
- Any SDK dependencies added to `package.json`
- Testnet transaction hash(es) showing the flow works

### Wallet Integration Checklist

- [ ] Adapter implements all four `WalletAdapter` methods
- [ ] `isAvailable()` correctly detects the wallet (returns `false` when not installed)
- [ ] `connect()` returns a valid Stellar public key (G...)
- [ ] `getNetwork()` returns the correct network string
- [ ] `signTransaction()` produces a valid signed XDR
- [ ] Wallet is registered in `WalletContext.tsx` adapters map
- [ ] Wallet selector UI includes the new option
- [ ] End-to-end tip flow works on testnet
- [ ] Error handling covers: not installed, access denied, signing cancelled, network mismatch
- [ ] No new dependencies added without review (if required, justify in PR)

## Testing Wallet Integration

### Unit Tests

Test the adapter in isolation by mocking the wallet SDK:

```typescript
// packages/app/src/lib/wallets/__tests__/freighterAdapter.test.ts
import { describe, it, expect, vi } from 'vitest';

const mockFreighter = {
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
};

vi.mock('@stellar/freighter-api', () => mockFreighter);

describe('freighterAdapter', () => {
  it('returns true when freighter is installed', async () => {
    mockFreighter.isConnected.mockResolvedValue({ isConnected: true });
    const { freighterAdapter } = await import('../freighterAdapter');
    expect(await freighterAdapter.isAvailable()).toBe(true);
  });

  it('returns the connected address', async () => {
    mockFreighter.requestAccess.mockResolvedValue(undefined);
    mockFreighter.getAddress.mockResolvedValue({ address: 'GA...' });
    const { freighterAdapter } = await import('../freighterAdapter');
    expect(await freighterAdapter.connect()).toBe('GA...');
  });
});
```

### Integration Tests (Manual)

Before opening a PR, run through this checklist manually:

| Test Case              | Expected Result                                          |
| ---------------------- | -------------------------------------------------------- |
| Wallet not installed   | `isAvailable()` returns `false`, UI shows install prompt |
| User clicks Connect    | Wallet popup appears, address returned                   |
| User rejects access    | Error thrown, UI shows "Access denied"                   |
| User signs transaction | Signed XDR returned, transaction submitted               |
| Network mismatch       | Error thrown, UI shows "Please switch network"           |
| Insufficient funds     | Horizon error, UI shows balance warning                  |

## Environment Variables Reference

All Stellar-related environment variables used across the app:

| Variable                           | Required | Description                                      |
| ---------------------------------- | -------- | ------------------------------------------------ |
| `NEXT_PUBLIC_STELLAR_NETWORK`      | Yes      | `testnet` or `mainnet`                           |
| `NEXT_PUBLIC_HORIZON_URL`          | Yes      | Horizon RPC endpoint                             |
| `NEXT_PUBLIC_SOROBAN_RPC`          | Yes      | Soroban RPC endpoint                             |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE`   | Yes      | Network passphrase for signing                   |
| `NEXT_PUBLIC_MARKET_CONTRACT_ID`   | Yes      | Deployed Market contract address                 |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | Yes      | Deployed Registry contract address               |
| `NEXT_PUBLIC_STELLAR_EXPLORER`     | No       | Custom explorer URL (defaults to stellar.expert) |

Set these in `packages/app/.env` for local development and in your deployment environment for production.
