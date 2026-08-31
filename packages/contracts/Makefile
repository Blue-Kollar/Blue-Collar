# BlueCollar Contracts Makefile
#
# Required env vars for deploy targets:
#   SOURCE          — Stellar secret key or funded account alias
#   ADMIN           — Admin Stellar address
#   FEE_RECIPIENT   — Address that receives protocol fees (market contract)
#   FEE_BPS         — Protocol fee in basis points, default 0

SOURCE        ?= $(error SOURCE is required)
ADMIN         ?= $(error ADMIN is required)
FEE_RECIPIENT ?= $(ADMIN)
FEE_BPS       ?= 0

WASM_DIR := target/wasm32v1-none/release

.PHONY: build build-registry build-market test coverage \
        fuzz fuzz-proptest fuzz-register fuzz-tip fuzz-migrate \
        audit security-scan \
        deploy-testnet deploy-mainnet \
        deploy-registry-testnet deploy-market-testnet \
        deploy-registry-mainnet deploy-market-mainnet \
        clean

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build: build-registry build-market

build-registry:
	cargo build --release --target wasm32v1-none --package bluecollar-registry

build-market:
	cargo build --release --target wasm32v1-none --package bluecollar-market

# Run the full workspace test suite (unit + upgrade framework + property tests).
test:
	cargo test --workspace

coverage:
	rustup component add llvm-tools-preview
	cargo install --locked cargo-llvm-cov
	cargo llvm-cov --workspace --lcov --output-path target/coverage/lcov.info --fail-under-lines 80

# ---------------------------------------------------------------------------
# Security Audit
# ---------------------------------------------------------------------------

# Install cargo-audit and scan for known vulnerabilities in dependencies
audit:
	cargo install --locked cargo-audit
	cargo audit

# Full security scan including audit, advisories check, and outdated dependencies
security-scan: audit
	@echo "Security scan completed. Check output above for any advisories."

# ---------------------------------------------------------------------------
# Fuzzing
# ---------------------------------------------------------------------------

# Property-based fuzz tests run under the normal test harness (no nightly
# required) and are the suite exercised in CI.
fuzz: fuzz-proptest

fuzz-proptest:
	cargo test -p bluecollar-fuzz --tests

# Coverage-guided libFuzzer targets (nightly + cargo-fuzz). The `fuzzing`
# feature gates the libFuzzer bins so they never break the normal build.
fuzz-register:
	cargo install --locked cargo-fuzz
	cargo +nightly fuzz run fuzz_register --features fuzzing -- -max_len=1024 -timeout=10

fuzz-tip:
	cargo install --locked cargo-fuzz
	cargo +nightly fuzz run fuzz_tip --features fuzzing -- -max_len=1024 -timeout=10

fuzz-migrate:
	cargo install --locked cargo-fuzz
	cargo +nightly fuzz run fuzz_migrate --features fuzzing -- -max_len=1024 -timeout=10

# ---------------------------------------------------------------------------
# Deploy — testnet
# ---------------------------------------------------------------------------

deploy-testnet: deploy-registry-testnet deploy-market-testnet

deploy-registry-testnet: build-registry
	./scripts/deploy-registry.sh \
	  --network testnet \
	  --source "$(SOURCE)" \
	  --admin "$(ADMIN)"

deploy-market-testnet: build-market
	./scripts/deploy-market.sh \
	  --network testnet \
	  --source "$(SOURCE)" \
	  --admin "$(ADMIN)" \
	  --fee-bps "$(FEE_BPS)" \
	  --fee-recipient "$(FEE_RECIPIENT)"

# ---------------------------------------------------------------------------
# Deploy — mainnet
# ---------------------------------------------------------------------------

deploy-mainnet: deploy-registry-mainnet deploy-market-mainnet

deploy-registry-mainnet: build-registry
	./scripts/deploy-registry.sh \
	  --network mainnet \
	  --source "$(SOURCE)" \
	  --admin "$(ADMIN)"

deploy-market-mainnet: build-market
	./scripts/deploy-market.sh \
	  --network mainnet \
	  --source "$(SOURCE)" \
	  --admin "$(ADMIN)" \
	  --fee-bps "$(FEE_BPS)" \
	  --fee-recipient "$(FEE_RECIPIENT)"

# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------

clean:
	cargo clean
