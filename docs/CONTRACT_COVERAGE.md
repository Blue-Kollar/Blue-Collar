# Contract Test Coverage

This document explains how to generate, read, and maintain test coverage reports
for the BlueCollar Soroban smart contracts (`packages/contracts`).

---

## Quick Start

```bash
cd packages/contracts

# Generate an LCOV report and enforce the 90% minimum (same as CI)
make coverage

# Generate a browseable HTML report
make coverage-html

# Generate the HTML report and open it in your default browser
make coverage-open

# Print a text summary to stdout (no output files written)
make coverage-summary
```

All targets install the required tooling automatically (`llvm-tools-preview`
component and `cargo-llvm-cov`) if they are not already present.

---

## Coverage Targets Explained

| Target             | Output                                   | CI gate |
| ------------------ | ---------------------------------------- | ------- |
| `coverage`         | `target/coverage/lcov.info`              | ✅ Yes  |
| `coverage-html`    | `target/coverage/html/index.html`        | ❌ No   |
| `coverage-open`    | Same as `coverage-html`, then opens it   | ❌ No   |
| `coverage-summary` | Text table printed to stdout             | ❌ No   |

### `coverage`

```bash
make coverage
```

Runs the full workspace test suite under `cargo-llvm-cov`, writes an LCOV data
file to `target/coverage/lcov.info`, and exits with a non-zero status code if
line coverage falls below **90%**.  This is the target that runs in CI; it is
the authoritative gate.

### `coverage-html`

```bash
make coverage-html
```

Runs the test suite and generates a self-contained HTML report under
`target/coverage/html/`.  Open `target/coverage/html/index.html` in any browser
to explore coverage line-by-line across all crates.

### `coverage-open`

```bash
make coverage-open
```

Generates the HTML report (calls `coverage-html`) and then immediately opens
`target/coverage/html/index.html` using `xdg-open` (Linux) or `open` (macOS).
If neither command is available, the path to the report is printed so you can
open it manually.

### `coverage-summary`

```bash
make coverage-summary
```

Prints a per-file and per-crate text table to stdout without writing any output
files.  Useful for a quick sanity check or for grepping specific numbers in
scripts.

---

## Minimum Coverage Target

**The project requires ≥ 90% line coverage across the entire contracts workspace.**

### Why 90%?

Smart contracts handle real funds and operate in a trustless environment.  A bug
that passes CI can be exploited on-chain with no recourse.  90% line coverage is
a pragmatic threshold that:

- Forces every public function to have at least one positive-path test.
- Ensures error branches (authorization failures, balance checks, state guards)
  are exercised.
- Still leaves room for unreachable defensive code and generated boilerplate
  that cannot realistically be covered.

### How It Is Enforced

The `coverage` Makefile target passes `--fail-under-lines 90` to
`cargo-llvm-cov`.  If the measured line coverage drops below 90%, the command
exits with a non-zero status, failing the Make rule.  In CI this causes the
workflow job to fail, blocking the pull request from being merged.

Locally, the same exit code means `make coverage` will print an error and stop:

```
error: coverage is below threshold: lines: 87.43% < 90%
make: *** [coverage] Error 1
```

To fix a failing coverage check:

1. Run `make coverage-html` to generate the HTML report.
2. Open `target/coverage/html/index.html` and identify uncovered lines (shown in
   red).
3. Add unit tests targeting those lines.
4. Re-run `make coverage` to confirm the threshold is now met.

---

## Verifying on a Clean Checkout

Follow these steps to reproduce the coverage result from scratch (e.g., on a new
machine or in a fresh CI runner):

1. **Install Rust** (stable toolchain via `rustup`):

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source "$HOME/.cargo/env"
   ```

2. **Add the LLVM tools component** (required by `cargo-llvm-cov`):

   ```bash
   rustup component add llvm-tools-preview
   ```

   > The `make coverage` target does this automatically, but running it
   > explicitly ensures the component is available before proceeding.

3. **Install `cargo-llvm-cov`**:

   ```bash
   cargo install --locked cargo-llvm-cov
   ```

4. **Navigate to the contracts package**:

   ```bash
   cd packages/contracts
   ```

5. **Run coverage**:

   ```bash
   make coverage
   ```

   A passing run ends with a summary table and exits with code `0`.  A failing
   run prints the coverage shortfall and exits with code `1`.

6. **(Optional) Inspect the full HTML report**:

   ```bash
   make coverage-html
   # then open target/coverage/html/index.html in a browser
   ```

---

## Reading the HTML Report

After running `make coverage-html`, open `target/coverage/html/index.html`.

The report is structured as follows:

- **Index page** — shows each source file with its line, function, and region
  coverage percentages.  Files are colour-coded: green ≥ 90%, amber 75–90%,
  red < 75%.
- **File view** — click any filename to see the annotated source.  Each line is
  highlighted:
  - **Green** — executed at least once during the test run.
  - **Red** — never executed (needs a test).
  - **No highlight** — not instrumented (comments, blank lines, macros that
    expand to nothing).
- **Count badges** — the number on the left of each line shows how many times
  that line was hit.  A count of `0` on a red line confirms it is uncovered.

Focus your test-writing effort on red lines inside `pub` functions — these are
the paths most likely to contain real bugs.

---

## Per-Crate Breakdown

The workspace currently contains multiple crates.  To see coverage broken down
per crate rather than per file, use the text summary:

```bash
make coverage-summary
```

The output table includes a `Filename` column that shows the crate path.  You
can filter it with `grep`:

```bash
# Show only registry crate numbers
make coverage-summary 2>&1 | grep registry

# Show only market crate numbers
make coverage-summary 2>&1 | grep market
```

To generate a per-crate LCOV file instead of a workspace-level one, run
`cargo-llvm-cov` directly:

```bash
cargo llvm-cov --package bluecollar-registry --lcov \
  --output-path target/coverage/registry.lcov.info

cargo llvm-cov --package bluecollar-market --lcov \
  --output-path target/coverage/market.lcov.info
```

---

## CI Integration

The `coverage` target runs automatically in the GitHub Actions CI pipeline on
every pull request and push to `main`.

The relevant workflow step is:

```yaml
- name: Contract coverage
  run: make coverage
  working-directory: packages/contracts
```

If coverage drops below 90%, the step fails and the PR cannot be merged.  The
generated `target/coverage/lcov.info` file is uploaded as a workflow artifact so
reviewers can download and inspect it without running the suite locally.

To replicate the exact CI environment locally, ensure you are using the same
Rust toolchain version pinned in `rust-toolchain.toml` (if present) or the
stable channel.
