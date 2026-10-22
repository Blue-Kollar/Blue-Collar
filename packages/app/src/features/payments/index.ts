/**
 * Public entry point for the payments feature (escrow + transaction UI).
 * Import from `@/features/payments` rather than the internal folders.
 */
export { default as EscrowForm } from "./components/EscrowForm";
export { default as EscrowStatus } from "./components/EscrowStatus";
export type { Escrow } from "./components/EscrowStatus";
export { default as PaymentButton } from "./components/PaymentButton";
export { default as TransactionConfirmDialog } from "./components/TransactionConfirmDialog";
export { useFreighterSigning } from "./hooks/useFreighterSigning";
