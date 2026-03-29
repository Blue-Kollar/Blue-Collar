# Contributing to BlueCollar

Thanks for your interest in contributing! Please read this guide before opening issues or pull requests.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Report violations to conduct@bluecollar.dev.

## How to Contribute

1. Check [open issues](https://github.com/Blue-Kollar/Blue-Collar/issues) for something to work on, or open a new one to discuss your idea first.
2. Fork the repo and create a feature branch:
   ```bash
   git checkout -b feat/your-feature
   ```
3. Make your changes following the guidelines below.
4. Open a pull request against `main` with a clear description.

## Development Setup

**Prerequisites:** Node.js >= 20, pnpm >= 9, PostgreSQL, Rust (for contracts)

```bash
git clone https://github.com/Blue-Kollar/Blue-Collar.git
cd Blue-Collar
pnpm install
```

**API:**
```bash
cp packages/api/.env.example packages/api/.env
# fill in DATABASE_URL and JWT_SECRET
cd packages/api
pnpm migrate
pnpm seed
pnpm dev        # :3000
```

**App:**
```bash
cd packages/app
pnpm dev        # :3001
```

**Contracts:**
```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
cd packages/contracts
cargo build --release --target wasm32-unknown-unknown
```

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(optional scope): <short description>

[optional body]
```

Common types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `ci`

Examples:
```
feat(api): add pagination to workers endpoint
fix(contracts): correct TTL threshold constant
docs: update environment variables table
chore(deps): bump prisma to 5.x
```

## Review Process

- All PRs require at least one approving review from a maintainer.
- CI checks (lint, type-check, tests) must pass before merge.
- Keep PRs focused — one concern per PR makes review faster.
- Maintainers may request changes; address feedback and re-request review.

## Package-Specific Guides

- [App (Next.js)](./packages/app/CONTRIBUTING.md)
