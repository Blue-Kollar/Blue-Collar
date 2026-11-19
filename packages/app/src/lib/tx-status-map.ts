import type { TxStatusValue } from '@bluecollar/types';

export type TxStatusIcon =
  | 'clock'
  | 'spinner'
  | 'check'
  | 'x'
  | 'alert'
  | 'ban';

export type TxStatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'error'
  | 'warning';

export interface TxStatusMeta {
  /** Translation key for the status label. */
  labelKey: string;
  /** Translation key for the status description/helper text. */
  descriptionKey: string;
  /** Icon identifier rendered by the TxStatus components. */
  icon: TxStatusIcon;
  /** Semantic tone used to derive colors/classes. */
  tone: TxStatusTone;
  /** Whether the status represents a terminal (final) state. */
  isTerminal: boolean;
  /** Whether the status represents an in-flight/pending state. */
  isPending: boolean;
  /** Whether the status represents a failure state. */
  isError: boolean;
}

export const TX_STATUS_MAP: Record<TxStatusValue, TxStatusMeta> = {
  pending: {
    labelKey: 'txStatus.pending.label',
    descriptionKey: 'txStatus.pending.description',
    icon: 'clock',
    tone: 'neutral',
    isTerminal: false,
    isPending: true,
    isError: false,
  },
  submitted: {
    labelKey: 'txStatus.submitted.label',
    descriptionKey: 'txStatus.submitted.description',
    icon: 'spinner',
    tone: 'info',
    isTerminal: false,
    isPending: true,
    isError: false,
  },
  confirming: {
    labelKey: 'txStatus.confirming.label',
    descriptionKey: 'txStatus.confirming.description',
    icon: 'spinner',
    tone: 'info',
    isTerminal: false,
    isPending: true,
    isError: false,
  },
  confirmed: {
    labelKey: 'txStatus.confirmed.label',
    descriptionKey: 'txStatus.confirmed.description',
    icon: 'check',
    tone: 'success',
    isTerminal: true,
    isPending: false,
    isError: false,
  },
  success: {
    labelKey: 'txStatus.success.label',
    descriptionKey: 'txStatus.success.description',
    icon: 'check',
    tone: 'success',
    isTerminal: true,
    isPending: false,
    isError: false,
  },
  failed: {
    labelKey: 'txStatus.failed.label',
    descriptionKey: 'txStatus.failed.description',
    icon: 'x',
    tone: 'error',
    isTerminal: true,
    isPending: false,
    isError: true,
  },
  rejected: {
    labelKey: 'txStatus.rejected.label',
    descriptionKey: 'txStatus.rejected.description',
    icon: 'ban',
    tone: 'warning',
    isTerminal: true,
    isPending: false,
    isError: true,
  },
  reverted: {
    labelKey: 'txStatus.reverted.label',
    descriptionKey: 'txStatus.reverted.description',
    icon: 'alert',
    tone: 'error',
    isTerminal: true,
    isPending: false,
    isError: true,
  },
  cancelled: {
    labelKey: 'txStatus.cancelled.label',
    descriptionKey: 'txStatus.cancelled.description',
    icon: 'ban',
    tone: 'neutral',
    isTerminal: true,
    isPending: false,
    isError: false,
  },
  unknown: {
    labelKey: 'txStatus.unknown.label',
    descriptionKey: 'txStatus.unknown.description',
    icon: 'alert',
    tone: 'neutral',
    isTerminal: false,
    isPending: false,
    isError: false,
  },
};

/**
 * Resolve metadata for a transaction status, falling back to the
 * `unknown` entry when the status is not recognized at runtime.
 */
export function getTxStatusMeta(status: TxStatusValue | string): TxStatusMeta {
  return (
    TX_STATUS_MAP[status as TxStatusValue] ?? TX_STATUS_MAP.unknown
  );
}

/**
 * Tailwind class fragments derived from a status tone.
 */
export const TX_STATUS_TONE_CLASSES: Record<
  TxStatusTone,
  { text: string; bg: string; border: string; icon: string }
> = {
  neutral: {
    text: 'text-gray-700',
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    icon: 'text-gray-500',
  },
  info: {
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    icon: 'text-blue-500',
  },
  success: {
    text: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-300',
    icon: 'text-green-500',
  },
  error: {
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: 'text-red-500',
  },
  warning: {
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: 'text-amber-500',
  },
};

/**
 * Resolve Tailwind class fragments for a transaction status.
 */
export function getTxStatusClasses(status: TxStatusValue | string) {
  return TX_STATUS_TONE_CLASSES[getTxStatusMeta(status).tone];
}