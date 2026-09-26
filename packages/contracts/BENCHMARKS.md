# BlueCollar Contract Benchmarks

This document records baseline resource-fee measurements for the key on-chain operations in the Registry and Market contracts. Baselines are captured using the Soroban test environment's built-in budget (`env.budget()`), which reports **CPU instructions** and **memory bytes** as defined by the Soroban host.

These numbers are the reference point for detecting regressions. If a PR causes a benchmark to increase by more than ~20%, the change should be scrutinised before merging.

---

## How to Run

```bash
cd packages/contracts

# Run all benchmarks and print results
cargo test benchmarks -- --nocapture

# Run only market benchmarks
cargo test -p bluecollar-market benchmarks -- --nocapture

# Run only registry benchmarks
cargo test -p bluecollar-registry benchmarks -- --nocapture

# Run only job-registry benchmarks
cargo test -p bluecollar-job-registry benchmarks -- --nocapture

# Or run the job-registry + market storage profile in one go (issue #1433)
./scripts/profile-storage.sh
```

Output lines are prefixed with `[BENCH]` for easy grepping:

```
[BENCH] market::tip  cpu=3012440 instructions  mem=184320 bytes
```

> **Note:** Benchmarks use `env.budget().reset_unlimited()` before each measurement. This disables the per-transaction budget cap so the test never fails due to resource limits â€” only the _cost_ is measured.

---

## Baseline Numbers

Baselines recorded on the `main` branch. Soroban host version: **v26.1.3**
(`soroban-env-host 26.1.3` / `soroban-sdk 26.1.0`).

> Market and Job-Registry numbers below are **measured** (the `[BENCH]` output
> pasted verbatim). The Registry table still holds the original estimated
> placeholders — `contracts/registry/src/benchmarks.rs` is not yet declared
> from `registry/src/lib.rs`, so it does not compile or run.

### Market Contract

| Operation | CPU Instructions | Memory Bytes | Notes |
|-----------|-----------------|--------------|-------|
| `tip` | 470,737 | 137,500 | Includes fee split + 2 token transfers |
| `create_escrow` | 322,320 | 122,336 | Locks funds in contract |
| `release_escrow` | 528,179 | 166,318 | Includes fee split + token transfer out |
| `cancel_escrow` | 333,511 | 122,772 | Refund after expiry |
| `create_multisig_escrow (2-of-2)` | 331,577 | 128,816 | Extra signer Vec storage |
| `approve_multisig_release (1-of-1, transfers)` | 356,550 | 137,812 | Final approval triggers transfer |
| `request_multisig_arbitration (fee=0)` | 169,946 | 85,912 | Storage-only path; 199,052/91,771 before issue #1433 |

### Job Registry Contract

| Operation | CPU Instructions | Memory Bytes | Notes |
|-----------|-----------------|--------------|-------|
| `post_job` (empty index) | 172,623 | 73,059 | 177,368/73,451 before issue #1433 |
| `post_job` (50 jobs indexed) | 478,598 | 242,042 | Index rewrite dominates; 485,341/242,434 before |
| `assign_worker` | 123,408 | 51,692 | 127,871/52,084 before issue #1433 |
| `complete_job` | 125,223 | 52,816 | 129,686/53,208 before issue #1433 |
| `cancel_job` | 121,678 | 50,972 | 126,141/51,364 before issue #1433 |

### Registry Contract

| Operation | CPU Instructions | Memory Bytes | Notes |
|-----------|-----------------|--------------|-------|
| `register (1 worker)` | ~2,000,000 | ~140,000 | New worker + list + count update |
| `batch_register (10 workers)` | ~18,000,000 | ~1,100,000 | ~1.8M CPU per worker |
| `toggle` | ~1,200,000 | ~100,000 | Read-modify-write of is_active |
| `update_reputation` | ~1,500,000 | ~110,000 | Writes reputation + history entry |
| `submit_review` | ~2,800,000 | ~170,000 | Updates inputs + computes weighted score |
| `stake` | ~3,800,000 | ~220,000 | Token transfer + StakeInfo write |

---

## Updating Baselines

After making changes that intentionally alter resource consumption (e.g. adding new storage fields, optimising loops), update this table:

1. Run `cargo test benchmarks -- --nocapture` and capture the output.
2. Update the table above with the new numbers.
3. Note the reason for the change in the PR description.
4. Commit the updated `BENCHMARKS.md` alongside the code change.

---

## Methodology

Each benchmark follows this pattern:

```rust
// 1. Set up contract state (not measured)
setup();

// 2. Reset budget to zero before the measured operation
env.budget().reset_unlimited();

// 3. Execute the operation
contract.operation(...);

// 4. Read and print the costs
let cpu = env.budget().cpu_instruction_cost();
let mem = env.budget().memory_bytes_cost();
println!("[BENCH] op  cpu={} instructions  mem={} bytes", cpu, mem);
```

`reset_unlimited()` sets the budget to "unlimited" mode â€” the host tracks costs without enforcing a cap. This prevents benchmark tests from ever failing due to resource limits while still measuring accurate costs.

---

## Interpreting Results

- **CPU instructions** map to Soroban's metered instruction count. On mainnet, each transaction has a CPU limit of ~100,000,000 instructions. A single operation consuming >10,000,000 instructions is expensive and warrants review.
- **Memory bytes** map to Soroban's heap allocation tracking. The limit per transaction is ~41,943,040 bytes. Most contract operations should be well under 1,000,000 bytes.
- Neither number maps directly to XLM fee cost â€” the actual fee also depends on ledger entry reads/writes and WASM execution size. Use the Stellar Lab fee estimator or `stellar contract invoke --fee-limit` for production fee estimates.
