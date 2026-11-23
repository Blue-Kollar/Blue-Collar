# Supported Assets in the Market Contract

The BlueCollar Market contract accepts **any SEP-41-compliant token** for tips
and escrow payments. This document describes the assumptions, constraints, and
tested asset types.

---

## Token Interface

All payment operations (`tip`, `create_escrow`, `release_escrow`,
`cancel_escrow`) use the standard `token::Client` (Soroban SEP-41 interface).
Any token contract that implements `transfer(from, to, amount)` will work,
including:

| Asset             | Notes                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **XLM (native)**  | Wrapped via the Stellar Asset Contract. Most liquid, no trustline required for XLM itself.  |
| **USDC**          | Standard SEP-41 Stellar USDC (Circle). Payer and worker must have an established trustline. |
| **Custom tokens** | Any Soroban-native or Stellar classic asset wrapped via `StellarAssetContract`.             |

---

## Trustline Requirements

Stellar classic assets (including USDC) require every account that holds or
receives them to have an established **trustline**. The contract does **not**
pre-check trustlines — it delegates this to the token contract itself:

- If the `from` address has no trustline for the token, the `transfer` call
  panics and the transaction is rolled back. **No state is written.**
- If the `to` address (worker / contract) has no trustline, the `transfer` call
  also panics and is rolled back.

This means missing-trustline failures are **graceful**: the operation reverts
atomically with no partial state change. The escrow record is never stored on
a failed `create_escrow`.

### Verifying trustlines before calling the contract

Before initiating a payment, confirm trustlines off-chain:

```bash
# Check whether an account has a trustline for a given asset issuer
stellar account info --account-id <ADDRESS> --network testnet \
  | jq '.balances[] | select(.asset_code == "USDC")'
```

If the field is absent, the account must add the trustline:

```bash
stellar tx change-trust \
  --asset-code USDC \
  --asset-issuer <USDC_ISSUER> \
  --source <ACCOUNT_SECRET> \
  --network testnet
```

---

## Fee Deduction

The protocol fee (`fee_bps`, 0–500) is applied identically regardless of token
type:

```
fee = floor(amount × fee_bps / 10_000)
worker_amount = amount − fee
```

The fee is transferred to the configured `fee_recipient` address in the same
token as the payment. The fee recipient must also have a trustline for classic
assets.

---

## Test Coverage

Multi-asset behavior is tested in two layers:

### Unit tests (`contracts/market/src/test.rs` — `multi_asset_tests` module)

| Test                                                   | What it verifies                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `tip_with_xlm_succeeds`                                | XLM tips transfer correctly                                                   |
| `tip_with_usdc_succeeds`                               | USDC tips transfer correctly                                                  |
| `tip_with_custom_token_succeeds`                       | Arbitrary third token works                                                   |
| `tip_tokens_are_isolated`                              | Tipping in one token does not affect another                                  |
| `escrow_create_and_release_with_usdc`                  | Full escrow lifecycle in USDC                                                 |
| `escrow_create_and_cancel_with_custom_token`           | Expiry cancellation in custom token                                           |
| `concurrent_escrows_in_different_tokens`               | Two open escrows in different assets; releasing one does not affect the other |
| `tip_with_zero_balance_token_panics_gracefully`        | Missing-balance failure reverts at token level                                |
| `create_escrow_insufficient_balance_panics_gracefully` | Failed create leaves no escrow record                                         |
| `escrow_not_created_on_transfer_failure`               | Atomic rollback on transfer failure confirmed                                 |
| `tip_fee_deducted_correctly_for_usdc`                  | Fee arithmetic correct for USDC                                               |
| `escrow_release_fee_deducted_for_custom_token`         | Fee arithmetic correct for custom token                                       |

### Property/fuzz tests (`contracts/fuzz/tests/market_fuzz.rs`)

| Property                                | What it verifies                                        |
| --------------------------------------- | ------------------------------------------------------- |
| `fuzz_tip_multi_asset_fee_invariant`    | Fee math holds for any (amount, fee_bps) over any token |
| `fuzz_multi_asset_escrow_release_exact` | Worker always receives exactly the locked amount        |
| `fuzz_fee_no_overflow`                  | Fee arithmetic never overflows for valid inputs         |
| `fuzz_escrow_amount_exact_storage`      | Stored amount equals the passed-in amount exactly       |

---

## Assumptions & Limitations

1. **No on-contract trustline check** — the contract trusts the token contract
   to enforce trustlines. If a token contract has a bug that allows transfers
   without trustlines, the Market contract would accept them.

2. **Decimals are opaque** — the contract operates on raw integer amounts in the
   token's smallest unit. The caller is responsible for applying the correct
   decimal conversion (e.g., USDC uses 7 decimal places on Stellar).

3. **No token allow-list** — any SEP-41 address can be used. The caller
   assumes responsibility for passing a legitimate, non-malicious token address.
   Future work may add an optional allow-list for mainnet deployments.

4. **Fee recipient trustline** — for classic assets, the configured
   `fee_recipient` address must hold a trustline for the payment token, or the
   fee transfer will revert the entire tip/release.
