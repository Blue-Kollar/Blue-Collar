# Payment Flows — Tipping & Escrow

> Issue #722 · Priority: High · Complexity: Medium

Full UI surface for token selection, fee preview, wallet signing, and all post-transaction states for **tipping** and **escrow** payments. All patterns use design tokens (`--primary: 221 83% 53%`, `--destructive: 0 84% 60%`) and Tailwind utility classes consistent with the rest of the design system.

---

## Table of Contents

- [Design Principles](#design-principles)
- [Shared Components](#shared-components)
  - [Token Selector](#token-selector)
  - [Amount Input & Fee Preview](#amount-input--fee-preview)
  - [Wallet Signing State](#wallet-signing-state)
- [Tip Flow](#tip-flow)
  - [1. Tip Entry](#1-tip-entry)
  - [2. Signing Waiting State](#2-signing-waiting-state)
  - [3. Tip Success](#3-tip-success)
  - [4. Tip Failure & Retry](#4-tip-failure--retry)
- [Escrow Flow](#escrow-flow)
  - [1. Escrow Create](#1-escrow-create)
  - [2. Escrow Locked](#2-escrow-locked)
  - [3. Escrow Release](#3-escrow-release)
  - [4. Escrow Cancel / Expired](#4-escrow-cancel--expired)
  - [5. Escrow Dispute](#5-escrow-dispute)
  - [6. Dispute In Progress](#6-dispute-in-progress)
  - [7. Dispute Resolved](#7-dispute-resolved)
- [Multi-Sig Escrow Flow](#multi-sig-escrow-flow)
  - [1. Multi-Sig Create](#1-multi-sig-create)
  - [2. Approval Collection](#2-approval-collection)
  - [3. Threshold Met — Auto-Release](#3-threshold-met--auto-release)
- [Transaction Result States](#transaction-result-states)
  - [Success](#success)
  - [Failure](#failure)
  - [Retry](#retry)
- [Error Recovery Paths](#error-recovery-paths)
- [Accessibility Notes](#accessibility-notes)

---

## Design Principles

| Principle                    | Rule                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| **Transparency**             | Always show the fee amount in human-readable form (e.g. "1% fee = 0.10 XLM") before the user signs. |
| **Progressive disclosure**   | Advanced options (multi-sig, custom expiry) are collapsed behind a toggle.                          |
| **Irreversibility warnings** | Any action that cannot be undone (release, cancel after expiry) requires a confirmation step.       |
| **Wallet-agnostic framing**  | UI copy says "Approve in wallet" not "Approve in Freighter" — other wallets may be added later.     |
| **Accessibility**            | All modals trap focus, use `role="dialog"`, and support keyboard dismissal via Escape.              |

---

## Shared Components

### Token Selector

Used in both tip and escrow flows to choose the payment token (XLM or any Stellar asset).

```
┌─────────────────────────────────────────────┐
│  Token                                      │
│  ┌─────────────────────────────────────┐    │
│  │ ◉  XLM  Stellar Lumens        ▼    │    │
│  └─────────────────────────────────────┘    │
│  ── dropdown open ────────────────────────  │
│  │ ◉  XLM  Stellar Lumens              │   │
│  │ ○  USDC  USD Coin                   │   │
│  │ ○  custom...  (paste address)       │   │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**States**: default, open, selected, invalid-address (red border + "Invalid token address" helper text).

**Props driving UI**:

- `token_addr: Address` — the selected Stellar token contract address.
- Balance shown beneath selector: fetched from Horizon, formatted to 7 dp.

---

### Amount Input & Fee Preview

```
┌─────────────────────────────────────────────┐
│  Amount                                     │
│  ┌──────────────────────────┐  [XLM]        │
│  │  10.00                   │               │
│  └──────────────────────────┘               │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Protocol fee   1%    =  0.10 XLM  │    │
│  │  You send              10.00 XLM   │    │
│  │  Recipient receives     9.90 XLM   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Fee calculation** (mirrors `tip()` on-chain logic):

```
fee_amount  = floor(amount × fee_bps / 10000)
net_amount  = amount − fee_amount
```

`fee_bps` is fetched from `get_config()` on mount (max 500 = 5%).

**Validation rules**:

- Amount > 0
- Amount ≤ wallet balance
- Amount must be a valid i128 (7 decimal places for XLM)

**Error states**:

- Empty / zero → "Enter an amount"
- Exceeds balance → "Insufficient balance"
- Non-numeric → "Invalid amount"

---

### Wallet Signing State

Shared spinner overlay used whenever an XDR is awaiting approval in the wallet extension.

```
┌─────────────────────────────────────────────┐
│                                             │
│           ◌ (animated ring, 48px)           │
│                                             │
│        Approve in your wallet               │
│    Check the Freighter extension popup      │
│                                             │
│         [ Cancel ]                          │
│                                             │
└─────────────────────────────────────────────┘
```

- `aria-live="polite"` region announces "Waiting for wallet approval".
- Cancel button calls `reject` on the pending XDR promise and returns the user to the previous step.
- If wallet popup closes without response after 60 s → auto-transition to **Failure** state with message "Wallet request timed out."

---

## Tip Flow

### 1. Tip Entry

Triggered from the worker profile page via "Send Tip" button.

```
┌─────────────────────────────────────────────┐
│  Send a tip to  [Worker Name]               │
│  ─────────────────────────────────────────  │
│  Token                                      │
│  ┌─────────────────────────────────────┐    │
│  │ ◉  XLM                         ▼   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Amount                                     │
│  ┌──────────────────────────┐  [XLM]        │
│  │  10.00                   │               │
│  └──────────────────────────┘               │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Protocol fee  1%   =   0.10 XLM   │    │
│  │  Recipient receives     9.90 XLM   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│       [ Send Tip ]   [ Cancel ]             │
└─────────────────────────────────────────────┘
```

"Send Tip" button is disabled until amount passes validation.  
Clicking "Send Tip" → builds XDR for `tip(from, to, token_addr, amount)` → transitions to **Signing Waiting State**.

---

### 2. Signing Waiting State

See [Wallet Signing State](#wallet-signing-state) above.

---

### 3. Tip Success

```
┌─────────────────────────────────────────────┐
│                                             │
│               ✓  (green, 48px)              │
│                                             │
│            Tip sent!                        │
│     9.90 XLM delivered to [Worker Name]     │
│                                             │
│  Transaction                                │
│  ┌─────────────────────────────────────┐    │
│  │  abc123…def  ↗ View on Stellar Expert│    │
│  └─────────────────────────────────────┘    │
│                                             │
│          [ Done ]   [ Tip Again ]           │
└─────────────────────────────────────────────┘
```

- Transaction hash links to `https://stellar.expert/explorer/{network}/tx/{hash}`.
- "Tip Again" resets the form to step 1 with same worker pre-filled.

---

### 4. Tip Failure & Retry

```
┌─────────────────────────────────────────────┐
│                                             │
│               ✕  (red, 48px)               │
│                                             │
│           Tip failed                        │
│     Transaction was rejected by the         │
│     network. Check your balance and         │
│     try again.                              │
│                                             │
│  Error detail (collapsible)                 │
│  ┌─────────────────────────────────────┐    │
│  │  op_underfunded                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│        [ Try Again ]   [ Cancel ]           │
└─────────────────────────────────────────────┘
```

"Try Again" returns to step 1 with previous values pre-filled.  
Raw error code is shown in a collapsed `<details>` element for debugging.

---

## Escrow Flow

### 1. Escrow Create

Triggered from job/agreement screen via "Pay with Escrow".

```
┌─────────────────────────────────────────────┐
│  Create Escrow Payment                      │
│  ─────────────────────────────────────────  │
│  Worker  [Worker Name]  G1abc…xyz           │
│                                             │
│  Token                                      │
│  ┌─────────────────────────────────────┐    │
│  │ ◉  XLM                         ▼   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Amount                                     │
│  ┌──────────────────────────┐  [XLM]        │
│  └──────────────────────────┘               │
│                                             │
│  Release deadline                           │
│  ┌──────────────────────────────────────┐   │
│  │  2026-07-25  (date picker)           │   │
│  └──────────────────────────────────────┘   │
│  After this date you may cancel & reclaim   │
│  funds if the worker hasn't released them.  │
│                                             │
│  ▶ Advanced (multi-sig)                     │
│                                             │
│     [ Create Escrow ]   [ Cancel ]          │
└─────────────────────────────────────────────┘
```

Clicking "Create Escrow" → builds XDR for `create_escrow(id, from, to, token_addr, amount, expiry)` → Signing Waiting State → **Escrow Locked**.

---

### 2. Escrow Locked

Dashboard card shown to both payer and worker after creation.

```
┌─────────────────────────────────────────────┐
│  🔒  Escrow  #ESC-0042                      │
│  ─────────────────────────────────────────  │
│  Status     LOCKED                          │
│  Amount     50.00 XLM                       │
│  Worker     [Worker Name]                   │
│  Payer      [Your Address]                  │
│  Expires    2026-07-25 00:00 UTC            │
│                                             │
│  ─────────────────────────────────────────  │
│  PAYER ACTIONS                              │
│  [ Release Funds ]   [ Dispute ]            │
│                                             │
│  WORKER ACTIONS                             │
│  [ Release to Me ]   [ Dispute ]            │
│                                             │
│  Cancel available after expiry date         │
└─────────────────────────────────────────────┘
```

- **Release Funds** (payer) and **Release to Me** (worker) both call `release_escrow(id, caller)`.
- Both trigger a confirmation dialog before building XDR.
- **Dispute** → [Escrow Dispute](#5-escrow-dispute) flow.

---

### 3. Escrow Release

Confirmation dialog before release:

```
┌─────────────────────────────────────────────┐
│  Release escrow funds?                      │
│                                             │
│  This will send 50.00 XLM to               │
│  [Worker Name]. This cannot be undone.      │
│                                             │
│     [ Confirm Release ]   [ Go Back ]       │
└─────────────────────────────────────────────┘
```

After signing → **Success** state with escrow ID and tx hash.

```
┌─────────────────────────────────────────────┐
│               ✓  (green, 48px)              │
│                                             │
│          Escrow Released                    │
│     50.00 XLM sent to [Worker Name]         │
│                                             │
│  Escrow     #ESC-0042                       │
│  Transaction  abc123…  ↗ View on Stellar    │
│                                             │
│              [ Done ]                       │
└─────────────────────────────────────────────┘
```

---

### 4. Escrow Cancel / Expired

**Before expiry** — Cancel button is disabled with tooltip "Available after 2026-07-25".

**After expiry** — Cancel becomes active. Confirmation dialog:

```
┌─────────────────────────────────────────────┐
│  Cancel and reclaim funds?                  │
│                                             │
│  The escrow deadline has passed. You can    │
│  reclaim 50.00 XLM to your wallet.          │
│  This cannot be undone.                     │
│                                             │
│     [ Confirm Cancel ]   [ Go Back ]        │
└─────────────────────────────────────────────┘
```

Calls `cancel_escrow(id, caller)` or `cancel_expired_escrow(id)`.

Success state:

```
┌─────────────────────────────────────────────┐
│               ✓  (green, 48px)              │
│                                             │
│          Escrow Cancelled                   │
│     50.00 XLM returned to your wallet       │
│                                             │
│  Transaction  abc123…  ↗ View on Stellar    │
│              [ Done ]                       │
└─────────────────────────────────────────────┘
```

---

### 5. Escrow Dispute

Triggered by either party clicking "Dispute" on the Locked card.

```
┌─────────────────────────────────────────────┐
│  Open a Dispute — Escrow #ESC-0042          │
│  ─────────────────────────────────────────  │
│  Arbitrator                                 │
│  ┌─────────────────────────────────────┐    │
│  │  (select from approved list)    ▼  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Arbitration fee  0.50 XLM                  │
│  (paid from your wallet to the arbitrator)  │
│                                             │
│  Reason  (optional, stored off-chain)       │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│     [ Open Dispute ]   [ Cancel ]           │
└─────────────────────────────────────────────┘
```

Calls `request_arbitration(escrow_id, caller, arbitrator, fee)`.  
On success → escrow card status changes to **IN DISPUTE**.

---

### 6. Dispute In Progress

```
┌─────────────────────────────────────────────┐
│  ⚖  Escrow  #ESC-0042                      │
│  ─────────────────────────────────────────  │
│  Status     IN DISPUTE                      │
│  Amount     50.00 XLM  (locked)             │
│  Arbitrator [Arbitrator Address]            │
│  Filed by   [Your Address]                  │
│                                             │
│  The arbitrator will review the case and    │
│  release funds to either party. You will    │
│  be notified when a decision is made.       │
│                                             │
│  No further actions available               │
└─────────────────────────────────────────────┘
```

All action buttons are disabled while `arbitration_requested = true`.

---

### 7. Dispute Resolved

After `resolve_arbitration()` is called by the arbitrator:

```
┌─────────────────────────────────────────────┐
│  ⚖  Escrow  #ESC-0042  — Resolved          │
│  ─────────────────────────────────────────  │
│  Outcome    Funds released to worker        │
│  Amount     50.00 XLM                       │
│  Decision   2026-07-10 14:32 UTC            │
│                                             │
│  Transaction  abc123…  ↗ View on Stellar    │
│              [ Done ]                       │
└─────────────────────────────────────────────┘
```

Outcome label maps to `DisputeOutcome` values:

| Contract value  | UI label                                     |
| --------------- | -------------------------------------------- |
| `ReleaseWorker` | "Funds released to worker"                   |
| `RefundPayer`   | "Funds returned to payer"                    |
| `PartialRefund` | "Partial refund — see transaction for split" |
| `Unresolved`    | "No decision — funds remain locked"          |

---

## Multi-Sig Escrow Flow

### 1. Multi-Sig Create

Accessed via "▶ Advanced (multi-sig)" toggle in the Escrow Create form.

```
┌─────────────────────────────────────────────┐
│  ▼ Advanced (multi-sig)                     │
│  ─────────────────────────────────────────  │
│  Signers  (addresses that must approve)     │
│  ┌─────────────────────────────────────┐    │
│  │  G1abc…  [ × ]                      │    │
│  │  G2def…  [ × ]                      │    │
│  │  [ + Add signer ]                   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Threshold                                  │
│  ┌──────────┐  of  2  signers              │
│  │  2       │                               │
│  └──────────┘                               │
│  Minimum approvals needed to release funds  │
└─────────────────────────────────────────────┘
```

Calls `create_multisig_escrow(id, from, to, token_addr, amount, expiry, signers, threshold)`.

Validation: threshold ≥ 1 and ≤ signers.length.

---

### 2. Approval Collection

Card shown to each signer:

```
┌─────────────────────────────────────────────┐
│  🔒  Multi-Sig Escrow  #MSC-0007            │
│  ─────────────────────────────────────────  │
│  Status     AWAITING APPROVALS              │
│  Amount     200.00 XLM                      │
│  Progress   ██░░  1 of 2 approvals          │
│                                             │
│  Signers                                    │
│  ✓ G1abc…  (approved)                      │
│  ○ G2def…  (pending)                        │
│                                             │
│     [ Approve Release ]                     │
│  (only shown to pending signers)            │
└─────────────────────────────────────────────┘
```

Calls `approve_multisig_release(id, caller)`.  
Progress bar fills as approvals accumulate.

---

### 3. Threshold Met — Auto-Release

When the final approval is submitted the contract automatically transfers funds. The UI transitions to:

```
┌─────────────────────────────────────────────┐
│               ✓  (green, 48px)              │
│                                             │
│      Multi-Sig Escrow Released              │
│  All approvals received. 200.00 XLM sent    │
│  to [Worker Name].                          │
│                                             │
│  Transaction  abc123…  ↗ View on Stellar    │
│              [ Done ]                       │
└─────────────────────────────────────────────┘
```

---

## Transaction Result States

### Success

Common anatomy (used by tip, escrow release, cancel, multi-sig):

```
┌─────────────────────────────────────────────┐
│                                             │
│   ✓  bg-green-100  text-green-700  48px    │
│                                             │
│   <Action> successful                       │
│   <Summary line>                            │
│                                             │
│   Transaction                               │
│   <hash truncated>  ↗ View on Stellar       │
│                                             │
│   [ Primary CTA ]   [ Secondary ]           │
└─────────────────────────────────────────────┘
```

Design tokens: icon uses `text-green-600`, card border `border-green-200 bg-green-50`.

---

### Failure

```
┌─────────────────────────────────────────────┐
│                                             │
│   ✕  bg-red-100  text-red-700  48px        │
│                                             │
│   <Action> failed                           │
│   <User-friendly reason>                    │
│                                             │
│   ▶ Technical detail  (collapsible)         │
│   <raw error string>                        │
│                                             │
│   [ Try Again ]   [ Cancel ]                │
└─────────────────────────────────────────────┘
```

Design tokens: icon uses `--destructive` (`text-red-600`), card border `border-red-200 bg-red-50`.

**Common failure messages**:

| Raw error / condition   | User-facing message                                            |
| ----------------------- | -------------------------------------------------------------- |
| `op_underfunded`        | "Insufficient balance to cover this payment."                  |
| `op_no_trust`           | "Your wallet doesn't trust this token. Add a trustline first." |
| Wallet timeout (60 s)   | "Wallet request timed out. Please try again."                  |
| User rejected in wallet | "You declined the transaction in your wallet."                 |
| `"Contract is paused"`  | "Payments are temporarily paused. Try again shortly."          |
| Network/Horizon error   | "Network error. Check your connection and try again."          |

---

### Retry

"Try Again" always pre-fills the previous form values and skips back to step 1 of the relevant flow (Tip Entry or Escrow Create). No state is lost.

---

## Error Recovery Paths

```
Tip Entry ──[user error]──────────────────► (inline field error, no modal)
     │
     ├──[wallet timeout / rejection]────────► Failure modal → Try Again → Tip Entry
     └──[network error]──────────────────────► Failure modal → Try Again → Tip Entry

Escrow Create ──[validation error]──────────► (inline, form stays open)
     │
     ├──[wallet rejection]────────────────────► Failure modal → Try Again → Escrow Create
     └──[Escrow Locked] ──[release fails]─────► Failure modal → Try Again → Escrow Locked

Escrow Locked ──[dispute filed]─────────────► In Dispute (actions disabled)
     │                └──[resolved]───────────► Resolved card (done)
     ├──[released]────────────────────────────► Success
     └──[cancelled after expiry]──────────────► Success

Multi-Sig ──[approve fails]─────────────────► Failure modal → Try Again → Approval card
     └──[threshold met]───────────────────────► Auto-release → Success
```

---

## Accessibility Notes

| Element                                | Requirement                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| All modals / dialogs                   | `role="dialog"`, `aria-modal="true"`, focus trap, Escape to dismiss                     |
| Signing waiting state                  | `aria-live="polite"` status region; spinner has `aria-label="Waiting for wallet"`       |
| Success / failure icons                | `aria-hidden="true"`; result heading is the announced content                           |
| Fee preview                            | `aria-label="Fee breakdown"` on container                                               |
| Token selector dropdown                | `role="listbox"` with `aria-selected` on options                                        |
| Disabled cancel button (before expiry) | `aria-disabled="true"` + `title` tooltip explaining when it unlocks                     |
| Progress bar (multi-sig approvals)     | `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax` = threshold |
