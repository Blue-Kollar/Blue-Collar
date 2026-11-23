# Contract Fuzzing Guide

This document describes how to run fuzzing tests on BlueCollar Soroban contracts using `cargo-fuzz` and `libfuzzer-sys`.

## Overview

Fuzzing is a testing technique that generates random inputs to discover edge cases and unexpected panics. We use two complementary approaches:

1. **Property-based tests** (`proptest`) — in `contracts/fuzz/tests/`
2. **Libfuzzer targets** (`cargo-fuzz`) — in `contracts/fuzz/fuzz_targets/`

## Prerequisites

- Rust nightly toolchain: `rustup toolchain install nightly`
- `cargo-fuzz`: `cargo install --locked cargo-fuzz`

## Running Fuzzing Tests

### Property-Based Tests (Recommended for CI)

Run the existing property-based tests with `proptest`:

```bash
cd packages/contracts
cargo test --test registry_fuzz
cargo test --test market_fuzz
```

These tests are deterministic and fast, making them ideal for CI pipelines.

### Libfuzzer Targets (For Continuous Fuzzing)

Run individual fuzz targets:

```bash
cd packages/contracts/contracts/fuzz

# Fuzz the register function with arbitrary string inputs
cargo +nightly fuzz run fuzz_register -- -max_len=1024 -timeout=10

# Fuzz the tip function with arbitrary amounts
cargo +nightly fuzz run fuzz_tip -- -max_len=1024 -timeout=10
```

Or use the Makefile:

```bash
cd packages/contracts
make fuzz-register
make fuzz-tip
```

### Fuzzing Options

| Option                 | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `-max_len=N`           | Maximum input size in bytes (default: 4096)       |
| `-timeout=N`           | Timeout per input in seconds (default: 1200)      |
| `-runs=N`              | Number of fuzzing iterations (default: unlimited) |
| `-artifact_prefix=DIR` | Directory to save crash artifacts                 |

Example: Run for 1 hour with crash artifacts:

```bash
cargo +nightly fuzz run fuzz_register -- \
  -max_len=1024 \
  -timeout=10 \
  -artifact_prefix=crashes/ \
  -runs=360000
```

## Fuzz Targets

### `fuzz_register`

**What it tests:** Registry contract's `register` function with arbitrary worker names, categories, and IDs.

**Invariants checked:**

- Function never panics with arbitrary string inputs
- Registered workers are stored correctly
- Worker is marked as active after registration

**Input:** `RegisterInput { worker_id, name, category }`

### `fuzz_tip`

**What it tests:** Market contract's `tip` function with arbitrary amounts and fee rates.

**Invariants checked:**

- Function never panics with arbitrary amounts
- Fee calculations are correct
- Token transfers are accurate

**Input:** `TipInput { amount, fee_bps }`

## Interpreting Results

### Successful Run

```
#123456	NEW    cov: 1234 ft: 5678 corp: 42/1.2Kb lim: 1024 exec/s: 1000 rss: 50Mb L: 256/1024 MS: 4 ...
```

- `cov`: Code coverage (higher is better)
- `ft`: Feature coverage (higher is better)
- `corp`: Corpus size (number of test cases)
- `exec/s`: Executions per second

### Crash Found

If a crash is found, libfuzzer saves the input to a file:

```
ERROR: libFuzzer encountered a crash:
Crash input saved to: crash-<hash>
```

**To reproduce the crash:**

```bash
cargo +nightly fuzz run fuzz_register crash-<hash>
```

**To debug:**

```bash
cargo +nightly fuzz cmin fuzz_register crash-<hash>  # Minimize crash input
cargo +nightly fuzz run fuzz_register crash-<hash> -- -verbosity=2
```

## CI Integration

Add to your CI pipeline (e.g., GitHub Actions):

```yaml
- name: Run contract fuzzing
  run: |
    cd packages/contracts
    cargo +nightly fuzz run fuzz_register -- -max_len=1024 -timeout=10 -runs=100000
    cargo +nightly fuzz run fuzz_tip -- -max_len=1024 -timeout=10 -runs=100000
```

Or run on a weekly schedule:

```yaml
on:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday
```

## Common Issues

### "error: could not compile `bluecollar-fuzz`"

Ensure you're using the nightly toolchain:

```bash
rustup toolchain install nightly
cargo +nightly fuzz run fuzz_register
```

### "error: libfuzzer not found"

Install `cargo-fuzz`:

```bash
cargo install --locked cargo-fuzz
```

### Slow fuzzing performance

- Reduce `-max_len` to speed up execution
- Increase `-timeout` if functions are slow
- Run on a machine with more CPU cores

## References

- [cargo-fuzz documentation](https://rust-fuzz.github.io/book/cargo-fuzz.html)
- [libfuzzer documentation](https://llvm.org/docs/LibFuzzer/)
- [Soroban SDK testing guide](https://developers.stellar.org/docs/learn/smart-contracts/testing)
