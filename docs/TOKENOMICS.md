# BlueCollar Tokenomics

> How value flows through the protocol: supported assets, fees, escrow economics,
> curator incentives, staking rewards, and subscription tiers.
> **Version**: 1.0 — Last updated: June 2026

---

## Table of Contents

- [Value Flow Overview](#value-flow-overview)
- [Supported Assets](#supported-assets)
- [Protocol Fee Architecture](#protocol-fee-architecture)
- [Escrow Economics](#escrow-economics)
- [Staking Economics](#staking-economics)
- [Subscription Tiers](#subscription-tiers)
- [Reputation Incentives](#reputation-incentives)
- [Curator Incentives](#curator-incentives)
- [Insurance Pool](#insurance-pool)
- [Open Economic Questions](#open-economic-questions)
- [References](#references)

---

## Value Flow Overview

```
                     ┌──────────────────────┐
                     │     Client/Payer      │
                     │    (wallet address)   │
                     └──────────┬───────────┘
                                │
                  ┌─────────────┼─────────────┐
                  │             │             │
                  ▼             ▼             ▼
          ┌────────────┐ ┌────────────┐ ┌──────────┐
          │  Direct     │ │  Escrow    │ │  Multi-  │
          │  Tip        │ │  Payment   │ │  sig     │
          │  (fee: bps) │ │  (no fee)  │ │  Escrow  │
          └───────┬─────┘ └───────┬────┘ └────┬─────┘
                  │               │           │
          ┌───────┴───────┐       │           │
          ▼               ▼       ▼           ▼
   ┌────────────┐  ┌────────────┐ ┌──────────────────────┐
   │  Worker     │  │  Protocol  │ │  Arbitrator (if      │
   │  (net -     │  │  Treasury  │ │  dispute)            │
   │   fee)      │  │  (fee)     │ │  (fee set by         │
   └────────────┘  └────────────┘ │   requester)          │
                                  └──────────────────────┘

   Off-chain (optional):
   ┌────────────────────────────────────────────────────────┐
   │  FeeDistribution contract splits Treasury fees to      │
   │  configured recipients (e.g. DAO treasury, insurance   │
   │  pool, development fund)                               │
   └────────────────────────────────────────────────────────┘
```

### Flow summary

1. **Client** sends tokens (XLM, USDC, or any Stellar asset) to the Market contract.
2. **Tips** incur a protocol fee (`fee_bps`, default 2.5%, hard-capped at 5%).
3. **Escrows** incur no protocol fee — the full amount is locked.
4. **Arbitration** fees are set by the requester and paid directly to the arbitrator; the protocol takes no cut.
5. **Staking** rewards are computed as a yield on staked principal (1 bps per 1000 seconds).
6. **Insurance** premiums are set per-pool by the admin (`premium_bps`).
7. **Subscription** fees are handled off-chain via Stripe.

---

## Supported Assets

### Current design: token-agnostic

The protocol does **not** maintain a hardcoded allowlist of tokens. All Stellar asset
contracts are treated uniformly — any valid Stellar token contract address can be
used in tips, escrows, staking, and insurance.

| Asset             | Type                         | Example Use            | Notes                                      |
| ----------------- | ---------------------------- | ---------------------- | ------------------------------------------ |
| **XLM**           | Native Stellar asset         | Tips, escrows, staking | Network fees are paid in XLM               |
| **USDC**          | Stellar Asset Contract (SAC) | Tips, escrows          | Circle-issued on Stellar                   |
| **Custom tokens** | Any Stellar `token::Client`  | Staking, insurance     | Must implement the Stellar token interface |

### How tokens reach the protocol

1. A user holds tokens in their Stellar wallet (e.g. Freighter).
2. The user invokes a contract function (`tip`, `create_escrow`, `stake`, `contribute`).
3. The contract calls `token.transfer(from, contract, amount)` — the Stellar network
   verifies the user's signature via `require_auth()`.

### Future: curated asset listing

There is no on-chain mechanism to restrict which tokens can be used. If the protocol
needs to gate assets (e.g. to prevent low-liquidity or scam tokens), that logic
would live in the **off-chain API** or a future **registry of approved assets**.

See [Open Economic Questions](#open-economic-questions) for discussion.

### Network fees

Stellar transaction fees (base fee ~0.00001 XLM per operation) are paid by the
**transaction submitter** in XLM. This applies to:

- Contract invocations (tips, escrows, staking)
- Contract deployments and upgrades
- Token transfers

The protocol does not subsidise network fees — users pay them organically through
their wallet.

---

## Protocol Fee Architecture

### Fee parameters

| Parameter            | Contract Value     | API Default    | Location                  |
| -------------------- | ------------------ | -------------- | ------------------------- |
| `MAX_FEE_BPS`        | **500** (5%)       | —              | `market/src/lib.rs:25`    |
| `fee_bps` (contract) | Configurable 0–500 | —              | `market/src/lib.rs:79–86` |
| `fee_bps` (API)      | —                  | **250** (2.5%) | `payment.service.ts:72`   |

### Fee calculation

**Formula** (same in contract and API):

```
fee = floor(amount × fee_bps / 10_000)
```

Where `amount` is in **stroops** (1 XLM = 10,000,000 stroops).

### Which operations incur a fee

| Operation                  | Fee              | Recipient                      |
| -------------------------- | ---------------- | ------------------------------ |
| **Direct tip** (`tip()`)   | `fee_bps` %      | `fee_recipient` (treasury)     |
| **Escrow create**          | None (0%)        | —                              |
| **Escrow release**         | None             | —                              |
| **Multi-sig escrow**       | None             | —                              |
| **Arbitration payment**    | Set by requester | Arbitrator (protocol takes 0%) |
| **Dispute filing**         | None             | —                              |
| **Staking**                | None             | —                              |
| **Insurance contribution** | None             | —                              |

### Fee distribution

Collected protocol fees flow to the **FeeDistribution contract**, which splits them
among configured recipients (e.g. DAO treasury, development fund, insurance pool).
Recipient percentages must sum to exactly 100% (10,000 bps).

```
share = available_balance × recipient.percentage_bps / 10_000
```

### Worked examples

#### Example 1: Direct tip with default fee

A client tips a worker **100 XLM** (1,000,000,000 stroops). The protocol fee is
the default **2.5% (250 bps)**.

| Field             | Calculation                           | Value (XLM)        |
| ----------------- | ------------------------------------- | ------------------ |
| Gross amount      |                                       | 100.00             |
| Fee (stroops)     | `floor(1_000_000_000 × 250 / 10_000)` | 25,000,000 stroops |
| Fee (XLM)         |                                       | 2.50               |
| Worker receives   | `100.00 - 2.50`                       | **97.50 XLM**      |
| Treasury receives |                                       | **2.50 XLM**       |

#### Example 2: Direct tip with capped fee

Same tip but the admin raised `fee_bps` to the maximum **5% (500 bps)**.

| Field             | Calculation                 | Value (XLM)   |
| ----------------- | --------------------------- | ------------- |
| Gross amount      |                             | 100.00        |
| Fee               | `floor(100 × 500 / 10_000)` | 5.00          |
| Worker receives   |                             | **95.00 XLM** |
| Treasury receives |                             | **5.00 XLM**  |

#### Example 3: Small tip

A client tips **1.50 XLM** with default fee (250 bps).

| Field                  | Value                                        |
| ---------------------- | -------------------------------------------- |
| Gross amount (stroops) | 15,000,000                                   |
| Fee (stroops)          | `floor(15_000_000 × 250 / 10_000) = 375,000` |
| Worker receives        | 14,625,000 stroops (**1.4625 XLM**)          |
| Treasury receives      | **0.0375 XLM**                               |

#### Example 4: Escrow (no fee)

Client locks **250 XLM** in escrow for a job. After completion, the full amount
is released to the worker.

| Field           | Value          |
| --------------- | -------------- |
| Escrow amount   | 250.00 XLM     |
| Protocol fee    | **0.00 XLM**   |
| Worker receives | **250.00 XLM** |

---

## Escrow Economics

### Standard escrows

| Parameter          | Value                                  |
| ------------------ | -------------------------------------- |
| Fee                | None (0%)                              |
| Expiry             | Set by creator (Unix timestamp)        |
| Release            | Callable by `from` or `to` at any time |
| Cancel             | `from` only after `expiry`             |
| Third-party cancel | Anyone can cancel an expired escrow    |

### Multi-sig escrows

| Parameter | Value                                               |
| --------- | --------------------------------------------------- |
| Fee       | None (0%)                                           |
| Signers   | Array of approved addresses                         |
| Threshold | `1 ≤ threshold ≤ signers.length`                    |
| Release   | Auto-executes when approval count reaches threshold |

### Arbitration fees

When a dispute escalates to arbitration:

- The requester sets the arbitrator fee (`fee: i128`) at the time of
  `request_arbitration()`.
- The fee is transferred **directly** from the requester to the arbitrator.
- The protocol takes **zero cut** of arbitration fees.
- There is no fixed fee schedule — market forces determine arbitrator pricing.

---

## Staking Economics

### Parameters

| Parameter                       | Value                    | Location                   |
| ------------------------------- | ------------------------ | -------------------------- |
| `UNSTAKE_COOLDOWN_SECS`         | **604,800** (7 days)     | `registry/src/lib.rs:1956` |
| `REWARD_RATE_BPS_PER_1000_SECS` | **1** (1 bps per 1000s)  | `registry/src/lib.rs:1958` |
| Min stake                       | None (only `amount > 0`) | —                          |
| Max stake                       | None                     | —                          |

### Reward calculation

```
elapsed = now - stake_timestamp  (in seconds)
rewards = staked_amount × 1 × elapsed / 10_000_000
```

The reward rate of 1 bps per 1000 seconds translates to approximately
**3.1536% APR** (assuming continuous staking):

```
APR ≈ (1 / 10_000) × (86_400 / 1_000) × 365.25 ≈ 3.154%
```

### Unstake flow

```
request_unstake()   →  7-day cooldown   →   unstake()
                                              ↳ returns principal + accumulated rewards
```

### Worked examples

#### Example 5: Staking 500 XLM for 30 days

| Field             | Calculation                                  | Value                       |
| ----------------- | -------------------------------------------- | --------------------------- |
| Staked amount     |                                              | 500 XLM                     |
| Duration          |                                              | 30 days = 2,592,000 seconds |
| Rewards (stroops) | `5_000_000_000 × 1 × 2_592_000 / 10_000_000` | 1,296,000,000 stroops       |
| Rewards (XLM)     |                                              | **129.60 XLM**              |
| Total returned    | 500 + 129.60                                 | **629.60 XLM**              |

#### Example 6: Staking 10,000 XLM for 90 days

| Field             | Calculation                                    | Value                       |
| ----------------- | ---------------------------------------------- | --------------------------- |
| Staked amount     |                                                | 10,000 XLM                  |
| Duration          |                                                | 90 days = 7,776,000 seconds |
| Rewards (stroops) | `100_000_000_000 × 1 × 7_776_000 / 10_000_000` | 77,760,000,000 stroops      |
| Rewards (XLM)     |                                                | **7,776.00 XLM**            |
| Total returned    | 10,000 + 7,776                                 | **17,776.00 XLM**           |

#### Example 7: Staking 100 XLM for 7 days (then unstake)

| Field             | Calculation                                | Value                    |
| ----------------- | ------------------------------------------ | ------------------------ |
| Staked amount     |                                            | 100 XLM                  |
| Duration          |                                            | 7 days = 604,800 seconds |
| Rewards (stroops) | `1_000_000_000 × 1 × 604_800 / 10_000_000` | 60,480,000 stroops       |
| Rewards (XLM)     |                                            | **6.048 XLM**            |
| Total returned    | 100 + 6.048                                | **106.048 XLM**          |

---

## Subscription Tiers

### On-chain

The Registry contract stores only the subscription **tier** and **expires_at**
timestamp. There is **no on-chain pricing** — tier metadata is handled off-chain.

### Off-chain (API + Stripe)

| Tier        | Features                                                                       | Pricing      |
| ----------- | ------------------------------------------------------------------------------ | ------------ |
| **Free**    | `basic_listing`                                                                | $0 (default) |
| **Pro**     | `basic_listing`, `portfolio`, `priority_search`                                | Via Stripe   |
| **Premium** | `basic_listing`, `portfolio`, `priority_search`, `analytics`, `featured_badge` | Via Stripe   |

Pricing is set via Stripe dashboard — no hardcoded amounts exist in the codebase.
Workers are downgraded to Free when their Stripe subscription expires
(`customer.subscription.deleted` webhook).

### On-chain sync

When a subscription is purchased or renewed via Stripe, the API calls
`update_subscription()` or `renew_subscription()` on the Registry contract to
keep the on-chain tier and expiry in sync.

---

## Reputation Incentives

### Scoring formula

A worker's reputation score (0–10,000 bps, i.e. 0.00%–100.00%) is a weighted
composite of three factors:

```
reputation = (quality × 60) + (volume × 25) + (recency × 15)  / 100
```

| Component   | Weight | Description                                    |
| ----------- | ------ | ---------------------------------------------- |
| **Quality** | 60%    | Average rating of the worker (0–10,000 bps)    |
| **Volume**  | 25%    | Tip/job count, capped at `MAX_TIP_VOLUME = 50` |
| **Recency** | 15%    | Time since last review, half-life ~90 days     |

### Auto-slashing

If a worker's average rating drops below **30% (3,000 bps)** and they have at
least **3 reviews**, their reputation is **halved**:

```
new_reputation = current_reputation / 2
```

This creates a strong deterrent against consistently poor service.

### Manual slashing

Admins with `ROLE_REP_MGR` can call `slash_reputation(worker_id, slash_bps)`
to subtract up to 10,000 bps from a worker's reputation at once.

### Economic effect

- **High reputation** → better search ranking, more client trust, higher earning
  potential (via tips).
- **Low reputation** → reduced visibility, potential auto-slash spiral.
- Reputation is **not monetisable** — it cannot be bought or transferred, only
  earned through quality work.

---

## Curator Incentives

### Current design

Curators are **not directly incentivised** on-chain. They are trusted off-chain
actors authorised by `ROLE_CURATOR_MGR` to:

- Register new workers (`register`, `batch_register`)
- Verify worker categories (`verify_category`)
- Award badges (`award_badge` when granted by admin)

There is no:

- Fee split for curators
- Reward per registration
- Staking requirement or bond
- Slashing for malicious behaviour

### Proposed incentives (not yet implemented)

| Proposal                    | Description                                                                       | Tracked in |
| --------------------------- | --------------------------------------------------------------------------------- | ---------- |
| **Curator bonding**         | Curators stake tokens that can be slashed for registering bad actors              | [#776]     |
| **Registration fee split**  | A portion of protocol fees directed to curators whose registrations generate tips | [#778]     |
| **Reputation for curators** | On-chain curator score based on the performance of workers they registered        | [#779]     |
| **Curator DAO / vote**      | Community-elected curators via token-weighted voting                              | [#780]     |

Without on-chain incentives, curator quality relies entirely on the admin's
off-chain vetting process. This is a recognised gap — see
[Open Economic Questions](#open-economic-questions).

---

## Insurance Pool

### Parameters

| Parameter     | Range               | Default  | Set by                  |
| ------------- | ------------------- | -------- | ----------------------- |
| `premium_bps` | 0–10,000 (0%–100%)  | Per-pool | Admin at `initialize()` |
| Contribution  | Any positive amount | —        | Pool member             |
| Claim amount  | Any positive amount | —        | Claimant                |

### How it works

1. A pool is initialised with a token address and a premium rate (`premium_bps`).
2. Members contribute tokens to the pool.
3. When a covered event occurs, members file claims.
4. `ROLE_CLAIMS_MGR` approves or rejects claims.
5. Approved claims are paid out from the pool balance.

### Worked example

#### Example 8: Insurance pool with 5% premium

Pool initialised with `premium_bps = 500` (5%). A worker contributes 1,000 XLM.

| Field                     | Value                  |
| ------------------------- | ---------------------- |
| Contribution              | 1,000 XLM              |
| Notional coverage (at 5%) | 20,000 XLM             |
| Claim filed               | 500 XLM                |
| Claim approved            | Paid from pool balance |

---

## Open Economic Questions

The following questions are **unresolved** and tracked as follow-up issues:

| #      | Question                                                                                       | Context                                               |
| ------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [#778] | Should curators receive a portion of tip fees from workers they registered?                    | Currently curators have no direct financial incentive |
| [#779] | Should curator reputation be on-chain and tied to registered-worker performance?               | Currently no accountability for curator quality       |
| [#780] | Should curators be elected via token-weighted vote rather than appointed by admin?             | Centralisation risk in curator selection              |
| [#781] | Should there be a minimum stake or bond for becoming a curator?                                | Sybil resistance for curator roles                    |
| [#782] | Should there be an approved-token list, or remain fully permissionless?                        | Scam-token risk vs. composability                     |
| [#783] | Should there be dynamic fee_bps (e.g. lower fees for high-volume users)?                       | Currently flat rate                                   |
| [#784] | Should staking rewards use a different curve (e.g. logarithmic, time-weighted)?                | Linear rewards may not optimise retention             |
| [#785] | Should arbitration fees have a protocol-defined minimum or be fully market-driven?             | Currently unconstrained                               |
| [#786] | Should the protocol subsidise Stellar network fees for certain operations?                     | Currently users pay all network fees                  |
| [#787] | Should subscription pricing be on-chain (e.g. via token payment) rather than off-chain Stripe? | Centralisation of subscription revenue                |

---

## References

| Document                   | Link                                                   |
| -------------------------- | ------------------------------------------------------ |
| Smart Contract Reference   | [CONTRACTS.md](./CONTRACTS.md)                         |
| Security Guide             | [SECURITY_GUIDE.md](./SECURITY_GUIDE.md)               |
| Environment Variables      | [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) |
| Incident Runbook           | [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md)           |
| Contract Integration Guide | [CONTRACT_INTEGRATION.md](./CONTRACT_INTEGRATION.md)   |
| Market Contract Source     | `packages/contracts/contracts/market/src/lib.rs`       |
| Registry Contract Source   | `packages/contracts/contracts/registry/src/lib.rs`     |
| Payment Service            | `packages/api/src/services/payment.service.ts`         |
| Subscriptions Controller   | `packages/api/src/controllers/subscriptions.ts`        |

---

> **Maintenance**: Update this document whenever fee parameters, staking parameters,
> subscription tiers, or incentive models change. Keep worked examples in sync with
> the actual contract and API code.
