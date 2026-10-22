# Environment Variables

## API (`packages/api`)

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `DATABASE_URL` | string | — | yes | PostgreSQL connection string |
| `TEST_DATABASE_URL` | string | — | test only | Separate DB for test runs |
| `JWT_SECRET` | string | — | yes | Secret for signing JWTs |
| `PORT` | number | `3000` | no | API listen port |
| `NODE_ENV` | string | `development` | no | `development` \| `test` \| `production` |
| `LOG_LEVEL` | string | `info` | no | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |
| `LOG_DIR` | string | `logs` | no | Directory for log files |
| `APP_URL` | string | `http://localhost:3001` | yes | Frontend URL (used in emails, OAuth) |
| `ALLOWED_ORIGINS` | string | `http://localhost:3001` | yes | Comma-separated CORS origins |
| `RATE_LIMIT_WINDOW_MS` | number | `900000` | no | Rate-limit window in ms |
| `RATE_LIMIT_MAX` | number | `100` | no | Max requests per window per IP |
| `REDIS_URL` | string | `redis://localhost:6379` | no | Redis URL for caching & rate-limit |
| `UPLOAD_DIR` | string | `storage/uploads` | no | File upload directory |
| `MAX_FILE_SIZE` | number | `5242880` | no | Max upload size in bytes |
| `GOOGLE_CLIENT_ID` | string | — | yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | string | — | yes | Google OAuth client secret |
| `MAIL_HOST` | string | — | yes | SMTP hostname |
| `MAIL_PORT` | number | `587` | no | SMTP port |
| `MAIL_USER` | string | — | yes | SMTP username |
| `MAIL_PASS` | string | — | yes | SMTP password |
| `VAPID_PUBLIC_KEY` | string | — | yes | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | string | — | yes | Web Push VAPID private key |
| `HORIZON_URL` | string | `https://horizon-testnet.stellar.org` | yes | Stellar Horizon base URL |
| `STELLAR_NETWORK` | string | `testnet` | no | `testnet` \| `mainnet` — controls SDK defaults |
| `REGISTRY_CONTRACT_ID` | string | — | yes | Soroban Registry contract ID |
| `MARKET_CONTRACT_ID` | string | — | yes | Soroban Market contract ID |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | string | — | no | OpenTelemetry collector endpoint |
| `PROFILE_DIR` | string | `storage/profiles` | no | CPU profile output directory |
| `SEED_ADMIN_EMAIL` | string | — | dev only | Admin seed account email |
| `SEED_ADMIN_PASSWORD` | string | — | dev only | Admin seed account password |
| `SEED_CURATOR_EMAIL` | string | — | dev only | Curator seed account email |
| `SEED_CURATOR_PASSWORD` | string | — | dev only | Curator seed account password |
| `VAULT_ADDR` | string | — | prod only | HashiCorp Vault address |
| `VAULT_TOKEN` | string | — | prod only | HashiCorp Vault token |

## App (`packages/app`)

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | string | `http://localhost:3000/api` | yes | API base URL |
| `NEXT_PUBLIC_APP_URL` | string | — | no | Public frontend URL |
| `NEXT_PUBLIC_STELLAR_NETWORK` | string | `TESTNET` | yes | `TESTNET` \| `MAINNET` |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | string | — | no | Horizon URL override |
| `NEXT_PUBLIC_MARKET_CONTRACT_ID` | string | — | yes | Market contract ID |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | string | — | yes | Registry contract ID |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | string | — | yes | Web Push VAPID public key |

## Monitoring (`packages/monitoring`)

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `STELLAR_RPC_URL` | string | `https://soroban-testnet.stellar.org` | yes | Soroban RPC endpoint to poll for contract events |
| `REGISTRY_CONTRACT_ID` | string | — | yes | Registry contract ID to monitor |
| `MARKET_CONTRACT_ID` | string | — | yes | Market contract ID to monitor |
| `ALERT_WEBHOOK_URL` | string | — | no | Webhook URL for critical-event alerts |

## Mobile (`packages/mobile`)

No `.env.example` is checked in — Expo reads `EXPO_PUBLIC_*` variables from the shell
environment or an untracked `.env` at `packages/mobile/`.

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | string | `http://localhost:3000/api` | no | API base URL |

## Contracts (`packages/contracts`)

Contracts don't read environment variables at build or deploy time — deploy parameters
(`SOURCE`, `ADMIN`, `FEE_RECIPIENT`, `FEE_BPS`, `--network`) are passed as `make`
arguments or CLI flags instead. See
[packages/contracts/README.md](../packages/contracts/README.md#deploy).

## Startup Validation

The API fails fast on startup if any required variable is missing. All environment access is centralised in `packages/api/src/config/config.ts` — no code outside that file reads `process.env` directly. The typed `config` object is re-exported from `packages/api/src/config/env.ts` for backwards compatibility.

To add a new variable: add it to `config.ts` using `required()` or `optional()` helpers, then document it in this table. Startup will throw a descriptive error message if a required key is absent.
