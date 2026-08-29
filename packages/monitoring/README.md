# BlueCollar Contract Monitoring

Event monitoring and alerting service for BlueCollar smart contracts.

## Features

- Real-time event monitoring for Registry and Market contracts
- Critical event alerting
- Contract balance tracking
- Gas usage monitoring
- Customizable alert webhooks

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your contract IDs and RPC endpoint
```

3. Run the monitor:
```bash
pnpm dev
```

## Configuration

- `STELLAR_RPC_URL`: Stellar RPC endpoint (testnet or mainnet)
- `REGISTRY_CONTRACT_ID`: Deployed Registry contract ID
- `MARKET_CONTRACT_ID`: Deployed Market contract ID
- `ALERT_WEBHOOK_URL`: Optional webhook for critical alerts

## Monitored Events

### Critical Events (trigger alerts):
- `WrkReg`: Worker registration
- `EscCrt`: Escrow creation
- `ArbReq`: Arbitration requested
- `ArbRes`: Arbitration resolved

### Tracked Metrics:
- Contract balance changes
- Event frequency
- Gas usage trends

## Dashboard

For a visual dashboard, integrate with monitoring tools like Grafana or Datadog.

## Architecture & Package Boundaries

- **[ADR 0001: Monorepo Package Boundaries](../../docs/adr/0001-monorepo-package-boundaries.md)** — documents monorepo boundary rules. `packages/monitoring` is a standalone observer service that reads from Stellar / Soroban contracts.
