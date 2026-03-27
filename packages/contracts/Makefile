# BlueCollar Contracts Makefile
# Requires: Rust, cargo, stellar CLI (https://developers.stellar.org/docs/tools/stellar-cli)

WASM_TARGET := wasm32-unknown-unknown
NETWORK     := testnet
REGISTRY_WASM := target/wasm32-unknown-unknown/release/bluecollar_registry.wasm
MARKET_WASM   := target/wasm32-unknown-unknown/release/bluecollar_market.wasm

.PHONY: build test deploy-testnet clean fmt clippy

## Build both contracts for release (WASM)
build:
	cargo build --release --target $(WASM_TARGET)

## Run all unit tests
test:
	cargo test

## Format all source files
fmt:
	cargo fmt

## Run Clippy with warnings-as-errors
clippy:
	cargo clippy -- -D warnings

## Deploy both contracts to Stellar testnet
## Requires STELLAR_ACCOUNT env var to be set to a funded testnet identity.
deploy-testnet: build
	stellar contract deploy \
		--wasm $(REGISTRY_WASM) \
		--source $(STELLAR_ACCOUNT) \
		--network $(NETWORK)
	stellar contract deploy \
		--wasm $(MARKET_WASM) \
		--source $(STELLAR_ACCOUNT) \
		--network $(NETWORK)

## Remove build artifacts
clean:
	cargo clean
