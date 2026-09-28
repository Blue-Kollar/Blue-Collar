# Issue #1433 — Optimise storage key patterns in `job_registry` and `market`

## Summary

Profiled the storage read/write footprint of the hot entrypoints in
`job_registry` and `market`, removed the redundant ledger operations that the
profile identified, and recorded the before/after resource cost so the
reduction is reproducible.

Three redundant operations were removed:

| Contract | Entrypoint | Removed operation |
|---|---|---|
| `job_registry` | `post_job` | Full `Job` (10-field) deserialisation used only as an existence probe → `storage.has()` |
| `job_registry` | every job write (`post_job`, `assign_worker`, `complete_job`, `cancel_job`, `dispute_job`) | A second `has()` probe of the same entry, performed by the shared `extend_ttl` helper immediately after the entry had just been `set` |
| `market` | `request_multisig_arbitration` | A provably no-op rewrite of the 10-field (two-`Vec`) `MultiSigEscrow` record |

---

## What was audited

### `job_registry` — `contracts/job_registry/src/storage.rs`

| Key | Type | Assessment |
|---|---|---|
| `Job(Symbol)` | whole `Job` record | Primary record. Read in full for a mere existence check before this change. |
| `JobList` | `Vec<Symbol>` (all job ids) | Append-only index; full rewrite per `post_job`. Required by `list_jobs`. |
| `PosterJobs(Address)` | `Vec<Symbol>` per poster | Index; **embeds a 32-byte `Address` in every key** — see "Deferred". |
| `RoleMembers(u64)` | `Vec<Address>` | Role lists, keyed by compact id (good pattern). |
| `Admin` | `Address` | Duplicate of `RoleMembers(0)`'s first element — see "Deferred". |
| `SchemaVersion` | `u32` | Written once, never read — retained deliberately, see "Deferred". |
| `Initialized` / `Paused` | instance `bool` | Correct. |

### `market` — `contracts/market/src/lib.rs`

| Key | Type | Assessment |
|---|---|---|
| `Escrow(Symbol)` | 8-field record | Rewritten in full to flip `released`/`cancelled`/`arbitration_requested` — unavoidable, Soroban has no partial-struct write. |
| `MultiSigEscrow(Symbol)` | 10 fields incl. 2 × `Vec<Address>` | Largest entry in the contract. Was rewritten once more than necessary (removed). |
| `Arbitration(Symbol)` | record | One per escrow id; correctly replaces a flag+record double write. |
| `Config` | instance record | Cheap (instance storage). |
| `Arbitrators`, `RoleMembers(u64)`, `Admin`, `SchemaVersion` | lists / scalars | `SchemaVersion` **is** read by `migrate()` — must stay. |

### Non-issues found

- `Escrow.arbitration_requested` (flag) and `Arbitration(id)` (record) look
  like a double representation, but the flag is the read at
  `lib.rs:1079` while the record is what `resolve_arbitration` consumes — both
  are load-bearing on their own path.
- `market` performs **no** `extend_ttl` calls anywhere. TTL extension is a
  resource *cost*, not a saving, and is out of scope for a fee-reduction
  issue.

---

## Profiling harness

`packages/contracts/scripts/` contained only deployment scripts, so the
profile is driven by the in-crate Soroban budget benchmarks:

- **Added** `contracts/job_registry/src/benchmarks.rs` (5 entrypoints) and
  wired `mod benchmarks;` into `job_registry/src/lib.rs`.
- **Wired up** `contracts/market/src/benchmarks.rs`: the file already existed
  but was never declared from `market/src/lib.rs`, so it had never compiled or
  run. It now runs 7 benchmarks (6 pre-existing + 1 added).
- **Added** `scripts/profile-storage.sh` to run both suites in one command.

```bash
cd packages/contracts
./scripts/profile-storage.sh          # or:
cargo test -p bluecollar-job-registry benchmarks -- --nocapture
cargo test -p bluecollar-market benchmarks -- --nocapture
```

---

## Results — before vs after

Measured with `env.budget().reset_unlimited()`, then
`cpu_instruction_cost()` / `memory_bytes_cost()`. "Before" is the same
benchmark compiled against the unmodified contract; "after" is this change.
Host: `soroban-env-host 26.1.3` / `soroban-sdk 26.1.0`.

### `job_registry`

| Entrypoint | CPU before | CPU after | Δ CPU | Mem before | Mem after | Δ Mem |
|---|---:|---:|---:|---:|---:|---:|
| `post_job` (empty index) | 177,368 | 172,623 | **−4,745 (−2.68 %)** | 73,451 | 73,059 | −392 (−0.53 %) |
| `post_job` (50 jobs already indexed) | 485,341 | 478,598 | **−6,743 (−1.39 %)** | 242,434 | 242,042 | −392 (−0.16 %) |
| `assign_worker` | 127,871 | 123,408 | **−4,463 (−3.49 %)** | 52,084 | 51,692 | −392 (−0.75 %) |
| `complete_job` | 129,686 | 125,223 | **−4,463 (−3.44 %)** | 53,208 | 52,816 | −392 (−0.74 %) |
| `cancel_job` | 126,141 | 121,678 | **−4,463 (−3.54 %)** | 51,364 | 50,972 | −392 (−0.76 %) |

The uniform −4,463 CPU / −392 mem is the redundant `has()` inside `extend_ttl`
disappearing from every job write. `post_job` gains a further −282 … −2,280 CPU
from the existence probe no longer deserialising the whole `Job`.

### `market`

| Entrypoint | CPU before | CPU after | Δ CPU | Mem before | Mem after | Δ Mem |
|---|---:|---:|---:|---:|---:|---:|
| `request_multisig_arbitration` (fee = 0) | 199,052 | 169,946 | **−29,106 (−14.62 %)** | 91,771 | 85,912 | −5,859 (−6.38 %) |
| `tip` | 470,737 | 470,737 | 0 (control) | 137,500 | 137,500 | 0 (control) |
| `create_escrow` | 322,320 | 322,320 | 0 (control) | 122,336 | 122,336 | 0 (control) |
| `release_escrow` | 528,179 | 528,179 | 0 (control) | 166,318 | 166,318 | 0 (control) |
| `cancel_escrow` | 333,511 | 333,511 | 0 (control) | 122,772 | 122,772 | 0 (control) |
| `create_multisig_escrow` (2-of-2) | 331,577 | 331,577 | 0 (control) | 128,816 | 128,816 | 0 (control) |
| `approve_multisig_release` (final) | 356,550 | 356,550 | 0 (control) | 137,812 | 137,812 | 0 (control) |

The six untouched entrypoints are controls: they prove the deltas above come
from the storage change and not from a measurement artefact.

### Storage-operation delta (from code inspection)

| Entrypoint | Entry reads before → after | Entry writes before → after |
|---|---|---|
| `job_registry::post_job` | `Job` full `get` for the duplicate check → `has`; plus one `has` removed from the TTL step | unchanged (3 index/record writes are all required) |
| `job_registry::assign_worker` / `complete_job` / `cancel_job` / `dispute_job` | 1 `has` removed each | unchanged |
| `market::request_multisig_arbitration` | unchanged | **1 full `MultiSigEscrow` write removed** (the host's `put` path for an existing entry does `has` + `get` + `put`, so this also drops a read) |

---

## Changes made

### `contracts/job_registry/src/storage.rs`
- Added `has_job(env, id)` — existence probe that never deserialises `Job`.
- `save_job` now extends the TTL directly on the key it just wrote, instead of
  calling `extend_ttl`, which re-probed the entry with `has()`.

### `contracts/job_registry/src/logic.rs`
- `do_post_job` uses `has_job(...)` for the `JobAlreadyExists` check.

### `contracts/market/src/lib.rs`
- `request_multisig_arbitration` no longer rewrites `MultiSigEscrow` after the
  `released || cancelled` guard has already proven `cancelled == false`.
  Verified against `soroban-env-host 26.1.3`
  (`put_contract_data_into_ledger`): re-writing an existing entry preserves
  its `live_until_ledger`, so dropping the write has **no** TTL side effect.

### New / repaired profiling files
- `contracts/job_registry/src/benchmarks.rs` (new)
- `contracts/market/src/benchmarks.rs` — now declared from `lib.rs`
- `scripts/profile-storage.sh` (new)

### Prerequisite fix
- `contracts/types/src/test_utils.rs` was missing
  `use soroban_sdk::testutils::Ledger as _;`, so the `testutils` feature did
  not compile. This blocked the test suites of every crate that dev-depends on
  `bluecollar-types` with `testutils` (`escrow`, `job_registry`, `payment`,
  `reputation`), so `job_registry`'s tests could not be run at all before the
  one-line fix.

---

## Deliberately deferred (with reasons)

1. **`DataKey::PosterJobs(Address)` embeds the poster address in the key.**
   Switching to a shorter key encoding orphans every existing ledger entry
   (Soroban encodes enum keys by *variant name + payload*, so a payload type
   change silently loses state). `VERSIONING.md` requires `upgrade()` **plus**
   `migrate()` plus a `SchemaVersion` bump for "changing storage key encoding",
   and `job_registry` has no `migrate()` entrypoint. Deferred to a dedicated
   migration issue.
2. **`Job.id` duplicates the key payload; `Admin` duplicates `RoleMembers(0)`.**
   `#[contracttype]` struct values decode with an exact field-count match, so
   removing a field breaks decoding of already-stored records. Needs the same
   migration path.
3. **`JobList` / `PosterJobs` are rewritten in full on every `post_job`.**
   This is the largest remaining growth term (visible as 177 k → 485 k CPU
   between an empty and a 50-job index), but `list_jobs()` and `poster_jobs()`
   are unpaginated public APIs; chunking the index would change their
   behaviour. A pagination issue should land first.
4. **`job_registry::SchemaVersion` is write-only.** Retained on purpose as the
   migration hook that item 1 will need.
5. **`market` has no `extend_ttl` calls at all.** Adding them would *increase*
   per-call cost; archival safety is a separate concern.

---

## Verification

```bash
cd packages/contracts
cargo test -p bluecollar-job-registry     # 55 passed (50 tests + 5 benchmarks)
cargo test -p bluecollar-market           # 120 passed (incl. create_escrow_within_budget)
cargo fmt --all -- --check
```
