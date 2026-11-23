# BlueCollar Contract Event Indexing Guide

## Overview

All BlueCollar contracts emit Soroban events on every state change. This document
is the canonical reference for indexer consumers. The schema is versioned — see
the `VERSION` constant (`pub const VERSION: u32 = 1`) exported by every contract.

## Event Structure

```
env.events().publish((topic1, topic2?, ...), data_payload)
```

- **Topics**: Searchable indexed fields. The first topic is always the event name
  (a `Symbol` of ≤ 9 characters). Subsequent topics are addresses, ids, or symbols.
- **Data**: Non-indexed context (amounts, timestamps, flags).

## Schema Version

| Contract        | `VERSION` | Changed in |
| --------------- | --------- | ---------- |
| Registry        | 1         | initial    |
| Market          | 1         | initial    |
| Dispute         | 1         | initial    |
| FeeDistribution | —         | —          |
| InsurancePool   | —         | —          |

Call `<contract>.version()` on-chain to confirm the version a deployment reports.

---

## Registry Contract Events

### Role Management

| Symbol   | Topics (after name)              | Data | Function      |
| -------- | -------------------------------- | ---- | ------------- |
| `RlGrnt` | `role: Symbol, account: Address` | —    | `grant_role`  |
| `RlRvkd` | `role: Symbol, account: Address` | —    | `revoke_role` |

### Delegation

| Symbol   | Topics                                 | Data              | Function          |
| -------- | -------------------------------------- | ----------------- | ----------------- |
| `DlgAdd` | `worker_id: Symbol, delegate: Address` | `expires_at: u64` | `add_delegate`    |
| `DlgRem` | `worker_id: Symbol, delegate: Address` | —                 | `remove_delegate` |

### Contract State

| Symbol     | Topics           | Data | Function  |
| ---------- | ---------------- | ---- | --------- |
| `Paused`   | `admin: Address` | —    | `pause`   |
| `Unpaused` | `admin: Address` | —    | `unpause` |

### Curator Management

| Symbol   | Topics                             | Data | Function         |
| -------- | ---------------------------------- | ---- | ---------------- |
| `CurAdd` | `admin: Address, curator: Address` | —    | `add_curator`    |
| `CurRem` | `admin: Address, curator: Address` | —    | `remove_curator` |

### Worker Registration

| Symbol   | Topics                               | Data                                 | Function                     |
| -------- | ------------------------------------ | ------------------------------------ | ---------------------------- |
| `WrkReg` | `worker_id: Symbol`                  | `(owner: Address, category: Symbol)` | `register`, `batch_register` |
| `WrkTgl` | `worker_id: Symbol`                  | `is_active: bool`                    | `toggle`, `batch_toggle`     |
| `WrkUpd` | `worker_id: Symbol`                  | `(name: String, category: Symbol)`   | `update`, `update_worker`    |
| `WrkDrg` | `worker_id: Symbol, caller: Address` | —                                    | `deregister`                 |

### Reputation

| Symbol       | Topics              | Data                                             | Function                     |
| ------------ | ------------------- | ------------------------------------------------ | ---------------------------- |
| `RepUpd`     | `worker_id: Symbol` | `score: u32`                                     | `update_reputation`          |
| `RepSlash`   | `worker_id: Symbol` | `(slash_bps: u32, new_rep: u32)`                 | `slash_reputation`           |
| `RepSlashed` | `worker_id: Symbol` | `(avg_rating: u32, new_rep: u32)`                | `submit_review` (auto-slash) |
| `RevSub`     | `worker_id: Symbol` | `(reviewer: Address, rating: u32, new_rep: u32)` | `submit_review`              |
| `JobComp`    | `worker_id: Symbol` | `(tip_count: u32, new_rep: u32)`                 | `record_job_completion`      |

### Category & Location

| Symbol       | Topics                                | Data                                                     | Function          |
| ------------ | ------------------------------------- | -------------------------------------------------------- | ----------------- |
| `CatVfy`     | `worker_id: Symbol, category: Symbol` | `(curator: Address, expires_at: u64)`                    | `verify_category` |
| `LocVfy`     | `worker_id: Symbol`                   | `(verifier: Address, verified_at: u64, expires_at: u64)` | `verify_location` |
| `CatAdded`   | `name: Symbol`                        | —                                                        | `add_category`    |
| `CatRemoved` | `name: Symbol`                        | —                                                        | `remove_category` |

### Availability & Subscription

| Symbol   | Topics              | Data                                                     | Function              |
| -------- | ------------------- | -------------------------------------------------------- | --------------------- |
| `AvlUpd` | `worker_id: Symbol` | `(is_available: bool, updated_at: u64, expires_at: u64)` | `update_availability` |
| `SubUpd` | `worker_id: Symbol` | `(tier: u32, expires_at: u64)`                           | `update_subscription` |
| `SubRnw` | `worker_id: Symbol` | `new_expires_at: u64`                                    | `renew_subscription`  |

### Staking

| Symbol      | Topics                               | Data                            | Function          |
| ----------- | ------------------------------------ | ------------------------------- | ----------------- |
| `Staked`    | `worker_id: Symbol, caller: Address` | `(amount: i128, total: i128)`   | `stake`           |
| `UnstakeRq` | `worker_id: Symbol, caller: Address` | `requested_at: u64`             | `request_unstake` |
| `Unstaked`  | `worker_id: Symbol, caller: Address` | `(staked: i128, rewards: i128)` | `unstake`         |

### Badges

| Symbol   | Topics                                | Data                              | Function       |
| -------- | ------------------------------------- | --------------------------------- | -------------- |
| `BdgAwd` | `worker_id: Symbol, badge_id: Symbol` | `(issuer: Address, name: String)` | `award_badge`  |
| `BdgRvk` | `worker_id: Symbol, badge_id: Symbol` | `caller: Address`                 | `revoke_badge` |

### Schema & Upgrade

| Symbol      | Topics                      | Data                           | Function          |
| ----------- | --------------------------- | ------------------------------ | ----------------- |
| `Migrated`  | —                           | `(from_ver: u32, to_ver: u32)` | `migrate`         |
| `UpgPropsd` | `execute_after_ledger: u32` | —                              | `propose_upgrade` |
| `UpgExecd`  | —                           | —                              | `execute_upgrade` |
| `UpgCancld` | —                           | —                              | `cancel_upgrade`  |

---

## Market Contract Events

### Role Management

| Symbol   | Topics                           | Data | Function      |
| -------- | -------------------------------- | ---- | ------------- |
| `RlGrnt` | `role: Symbol, account: Address` | —    | `grant_role`  |
| `RlRvkd` | `role: Symbol, account: Address` | —    | `revoke_role` |

### Contract State

| Symbol     | Topics           | Data | Function  |
| ---------- | ---------------- | ---- | --------- |
| `Paused`   | `admin: Address` | —    | `pause`   |
| `Unpaused` | `admin: Address` | —    | `unpause` |

### Config

| Symbol   | Topics            | Data                    | Function       |
| -------- | ----------------- | ----------------------- | -------------- |
| `TrsSet` | `caller: Address` | `new_treasury: Address` | `set_treasury` |

### Payments

| Symbol     | Topics                       | Data                              | Function                |
| ---------- | ---------------------------- | --------------------------------- | ----------------------- |
| `TipSent`  | `from: Address, to: Address` | `(token: Address, amount: i128)`  | `tip`                   |
| `FeeTaken` | —                            | `(fee: i128, recipient: Address)` | `tip`, `release_escrow` |

### Escrow

| Symbol   | Topics                      | Data                                                       | Function                                 |
| -------- | --------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `EscCrt` | `id: Symbol, from: Address` | `(to: Address, token: Address, amount: i128, expiry: u64)` | `create_escrow`                          |
| `EscRel` | `id: Symbol, to: Address`   | `amount: i128`                                             | `release_escrow`, `batch_release_escrow` |
| `EscCnl` | `id: Symbol, from: Address` | `amount: i128`                                             | `cancel_escrow`                          |
| `EscExp` | `id: Symbol, from: Address` | `amount: i128`                                             | `cancel_expired_escrow`                  |

### Multi-Signature Escrow

| Symbol     | Topics                        | Data                                          | Function                                       |
| ---------- | ----------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `MsEscCrt` | `id: Symbol, from: Address`   | `(to: Address, amount: i128, threshold: u32)` | `create_multisig_escrow`                       |
| `MsEscApv` | `id: Symbol, caller: Address` | `approvals_count: u32`                        | `approve_multisig_release`                     |
| `MsEscRel` | `id: Symbol, to: Address`     | `amount: i128`                                | `approve_multisig_release` (threshold reached) |
| `MsEscCnl` | `id: Symbol, from: Address`   | `amount: i128`                                | `cancel_multisig_escrow`                       |

### Arbitration

| Symbol     | Topics                                   | Data                               | Function                       |
| ---------- | ---------------------------------------- | ---------------------------------- | ------------------------------ |
| `ArbAdd`   | `admin: Address, arb: Address`           | —                                  | `add_arbitrator`               |
| `ArbRem`   | `admin: Address, arb: Address`           | —                                  | `remove_arbitrator`            |
| `ArbReq`   | `escrow_id: Symbol, caller: Address`     | `(arbitrator: Address, fee: i128)` | `request_arbitration`          |
| `ArbRes`   | `escrow_id: Symbol, arbitrator: Address` | `release_to_worker: bool`          | `resolve_arbitration`          |
| `MsArbReq` | `escrow_id: Symbol, caller: Address`     | `(arbitrator: Address, fee: i128)` | `request_multisig_arbitration` |
| `MsArbRes` | `escrow_id: Symbol, arbitrator: Address` | `release_to_worker: bool`          | `resolve_multisig_arbitration` |

---

## Dispute Contract Events

| Symbol      | Topics                            | Data                                  | Function            |
| ----------- | --------------------------------- | ------------------------------------- | ------------------- |
| `Init`      | —                                 | `admin: Address`                      | `initialize`        |
| `Paused`    | `admin: Address`                  | —                                     | `pause`             |
| `Unpaused`  | `admin: Address`                  | —                                     | `unpause`           |
| `ArbAdd`    | —                                 | `arbitrator: Address`                 | `add_arbitrator`    |
| `ArbRem`    | —                                 | `arbitrator: Address`                 | `remove_arbitrator` |
| `DspOpen`   | `id: Symbol, disputer: Address`   | `(respondent: Address, amount: i128)` | `file_dispute`      |
| `DspEvid`   | `id: Symbol, caller: Address`     | —                                     | `submit_evidence`   |
| `DspDcide`  | `id: Symbol, arbitrator: Address` | `(outcome: u32, split_bps: u32)`      | `decide`            |
| `DspSettle` | `id: Symbol`                      | `(outcome: u32, amount: i128)`        | `settle`            |

### Dispute Outcome Values

| `outcome` u32 | Meaning                            |
| ------------- | ---------------------------------- |
| `0`           | `RefundDisputer` — full refund     |
| `1`           | `ReleaseRespondent` — full release |
| `2`           | `Split` — split per `split_bps`    |

---

## Fee Distribution Contract Events

| Symbol     | Topics                           | Data           | Function             |
| ---------- | -------------------------------- | -------------- | -------------------- |
| `RlGrnt`   | `role: Symbol, account: Address` | —              | `grant_role`         |
| `RlRvkd`   | `role: Symbol, account: Address` | —              | `revoke_role`        |
| `Paused`   | `caller: Address`                | —              | `pause`              |
| `Unpaused` | `caller: Address`                | —              | `unpause`            |
| `FeeRcp`   | `recipient_count: u32`           | —              | `set_fee_recipients` |
| `FeeColl`  | `token: Address`                 | `amount: i128` | `collect_fees`       |
| `FeeDistr` | `recipient: Address`             | `amount: i128` | `distribute_fees`    |
| `FeeWdraw` | `token: Address`                 | `amount: i128` | `withdraw_fees`      |

---

## Indexing Best Practices

### Filter by event name and indexed fields

```javascript
// All workers registered in category "plumber"
events.filter((e) => e.topics[0] === 'WrkReg').filter((e) => e.data[1] === 'plumber');
```

### Reconstruct dispute state

```javascript
const phases = ['Open', 'Evidence', 'Decided', 'Settled'];
events
  .filter((e) => e.topics[1] === dispute_id)
  .reduce((state, e) => {
    if (e.topics[0] === 'DspOpen') state.phase = 'Open';
    if (e.topics[0] === 'DspEvid') state.phase = 'Evidence';
    if (e.topics[0] === 'DspDcide') state.phase = 'Decided';
    if (e.topics[0] === 'DspSettle') state.phase = 'Settled';
    return state;
  }, {});
```

### Track fee revenue

```javascript
events.filter((e) => e.topics[0] === 'FeeTaken').reduce((total, e) => total + e.data[0], 0n); // sum fees
```

## Schema Change Policy

1. Bump `VERSION` in the contract source whenever an event is added, removed, or
   its topics/data shape changes.
2. Update this document in the same PR.
3. Old event names must not be reused for different semantics.
4. Additive changes (new events) are non-breaking; structural changes require
   a major version bump and a migration path for indexers.
