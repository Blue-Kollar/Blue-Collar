# Triage: duplicate utility functions (#1824)

## Checked

Three dispute operations are defined in more than one service:

- `fileEscrowDispute`: `src/services/contracts.service.ts` and `src/services/escrow.service.ts`
- `resolveEscrowDispute`: `src/services/contracts.service.ts` and `src/services/escrow.service.ts`
- `resolveDispute`: `src/services/escrow.service.ts` and `src/services/dispute.service.ts`

In `contracts.service.ts` the escrow functions validate input and then call `escrow.service.ts`. The `resolveDispute` functions in `escrow.service.ts` and `dispute.service.ts` do different work: one resolves an escrow record, and the other resolves a general dispute.

## Not verified

- Whether the two `resolveDispute` functions are called from the same routes.

## Not changed

No code change was made. Removing one of the copies needs a decision about which service owns escrow disputes.
