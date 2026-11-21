# Triage: Stellar service module isolation (#1822)

## Checked

- No file under `packages/api/src` imports a Stellar package directly (`@stellar/*` or `stellar-sdk`).
- Stellar access goes through `src/clients/stellar.client.ts`, used by `src/services/wallet.service.ts`, and `src/services/stellar.service.ts`.

## Not verified

- Whether `stellar.service.ts` and `stellar.client.ts` overlap in responsibility.
- Whether any controller calls the client directly, bypassing the service layer.

## Not changed

No code change was made, because the isolation the issue asks for appears to be in place. This note records what was checked, not a fix.
