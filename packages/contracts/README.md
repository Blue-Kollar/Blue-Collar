# Stellar Soroban Smart Contracts

Rust-based smart contracts for the BlueCollar protocol, compiled to WebAssembly and deployed to the Stellar network.

## Path Aliases

This is a **Rust project** and does not use TypeScript or JavaScript. Path alias conventions (like `@/*`) only apply to TypeScript/JavaScript packages.

Rust uses a module system with `mod` declarations and `use` statements for imports. Module organization follows Rust conventions, not TypeScript conventions.

## Project Structure

```
packages/contracts/
├── contracts/
│   ├── registry/      # Worker registry contract
│   ├── market/        # Payment & escrow contract
│   ├── dispute/       # Dispute resolution contract
│   ├── fee_distribution/  # Fee collection & distribution
│   └── insurance_pool/    # Insurance pool management
├── Cargo.toml         # Rust manifest
└── README.md
```

## Building

See the main [README.md](../../README.md#smart-contracts) for build and deployment instructions.
