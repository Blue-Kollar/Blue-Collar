# Contributing to BlueCollar Soroban Contracts

This guide is for contributors who want to work on the Rust-based Soroban smart contracts in `packages/contracts`.

## Rust / Soroban toolchain

- Install the Rust toolchain with `rustup`.
- Use the stable toolchain:
  ```bash
  rustup default stable
  rustc --version
  ```
- Add the Soroban WASM target:
  ```bash
  rustup target add wasm32v1-none
  ```
- Install recommended Rust components:
  ```bash
  rustup component add rustfmt clippy
  ```
- Optional tooling for coverage:
  ```bash
  rustup component add llvm-tools-preview
  cargo install --locked cargo-llvm-cov
  ```
- Install the Stellar CLI for deployment and contract interaction:
  ```bash
  cargo install --locked stellar-cli
  ```

## Build workflow

From `packages/contracts`:

```bash
cd packages/contracts
make build
```

Or build a single contract:

```bash
make build-registry
make build-market
```

The wasm artifacts are written to `target/wasm32v1-none/release/`.

## Test workflow

Run the contract test suite from the workspace root:

```bash
cd packages/contracts
cargo test --workspace
```

Run a single package if needed:

```bash
cargo test --package bluecollar-registry
cargo test --package bluecollar-market
```

Format and lint before committing:

```bash
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
```

### Writing unit tests

Contract tests use `soroban-sdk` test utilities and standard Rust test conventions.

- Create an `Env` with `Env::default()`.
- Use `env.mock_all_auths()` when a tested invocation requires authorization.
- Register the contract with `env.register_contract(None, YourContract)`.
- Use the generated contract client wrappers like `RegistryContractClient::new(&env, &contract)`.
- Use `Symbol::new(&env, "..." )` for on-chain IDs.
- Use `String::from_str(&env, "...")` for text fields.
- Use `Address::generate(&env)` for test account addresses.

Example test:

```rust
#[test]
fn test_register_success() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = env.register_contract(None, RegistryContract);
    let client = RegistryContractClient::new(&env, &contract);
    let owner = Address::generate(&env);

    client.register(
        &Symbol::new(&env, "w1"),
        &owner,
        &String::from_str(&env, "Alice"),
        &Symbol::new(&env, "electrician"),
    );

    let worker = client.get_worker(&Symbol::new(&env, "w1")).unwrap();
    assert_eq!(worker.owner, owner);
    assert_eq!(worker.is_active, true);
}
```

## Deployment workflow

Deploy the registry and market contracts to testnet:

```bash
cd packages/contracts
make deploy-testnet \
  SOURCE=deployer \
  ADMIN=<your-stellar-address> \
  FEE_RECIPIENT=<treasury-address> \
  FEE_BPS=100
```

For mainnet:

```bash
cd packages/contracts
make deploy-mainnet \
  SOURCE=<mainnet-key-alias> \
  ADMIN=<admin-address> \
  FEE_RECIPIENT=<treasury-address> \
  FEE_BPS=100
```

You can also deploy each contract manually with the scripts in `packages/contracts/scripts/`.

## Storage TTL and key conventions

### Storage TTL strategy

The Soroban contracts store worker entries with an on-chain TTL measured in ledger numbers.

- `TTL_EXTEND_TO` is approximately `535_000` ledgers (~1 year).
- `TTL_THRESHOLD` is approximately `267_500` ledgers (~6 months).
- Both constants and the `extend_ttl(&env, &key)` helper live in
  `bluecollar_types::storage`. Call that helper instead of writing the
  `env.storage().persistent().extend_ttl(...)` sequence in a contract.
- Every write extends the stored entry TTL automatically.
- A public extension entry exists so anyone can refresh a worker record.

### Key and ID conventions

- Use `Symbol` values for contract-level IDs such as worker IDs, categories, and hashed location/contact values.
- Use `Address` for account references and signer identities.
- Use `String::from_str(&env, "...")` for human-readable text input.
- Use `BytesN<32>` for fixed-size hashes and WASM hashes.
- Prefer the contract client wrappers (`RegistryContractClient`, `MarketContractClient`) in tests instead of raw call APIs.

## Error Handling

All contract entrypoints **must** return `Result<T, ContractError>` where
`ContractError` is the shared `#[contracterror]` enum defined in the
`bluecollar-types` crate (`contracts/types/src/errors.rs`).

### Rules

1. **No string-based panics in entrypoints.**
   `.expect("…")`, `panic!("…")`, and `assert!(…, "…")` are **forbidden** in
   any function exposed via `#[contractimpl]`. Use typed error propagation
   instead:

   ```rust
   // ❌ Don't do this
   let worker = storage.get(&key).expect("Worker not found");

   // ✅ Do this
   let worker = storage.get(&key).ok_or(ContractError::WorkerNotFound)?;
   ```

2. **Use `?` propagation.**
   Chain `.ok_or(ContractError::Variant)?` for `Option` values and
   `return Err(ContractError::Variant)` for explicit guard clauses.

3. **Reserve `panic!` / `unreachable!` for true invariants only.**
   If a code path is logically impossible (e.g. after an exhaustive match),
   `unreachable!()` is acceptable. Every other error condition must surface a
   `ContractError` variant so callers can handle it programmatically.

4. **Add new variants with explicit discriminants.**
   When you need a new error, append a variant to the `ContractError` enum with
   the next available `u32` discriminant. Never reorder or remove existing
   variants—this would break on-chain ABI compatibility.

5. **Test error paths with `try_*` methods.**
   The Soroban SDK generates `try_<method>` client methods that return
   `Result<Result<T, ContractError>, …>`. Use these in tests instead of
   `#[should_panic]`:

   ```rust
   // ❌ Don't do this
   #[test]
   #[should_panic(expected = "Worker not found")]
   fn test_missing_worker() { … }

   // ✅ Do this
   #[test]
   fn test_missing_worker() {
       let res = client.try_get_worker(&bad_id);
       assert_eq!(res, Err(Ok(ContractError::WorkerNotFound)));
   }
   ```

## Notes

- Do not edit generated WASM artifacts in source control.
- Keep commit messages in Conventional Commits format to support release automation.
