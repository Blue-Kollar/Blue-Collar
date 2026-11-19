import React from 'react';
import { TxStatusPending } from './TxStatusPending';
import { TxStatusConfirmed } from './TxStatusConfirmed';
import { TxStatusFailed } from './TxStatusFailed';

export type TxStatusValue =
  | 'idle'
  | 'pending'
  | 'confirmed'
  | 'failed';

export interface TxStatusProps {
  status: TxStatusValue;
  txHash?: string;
  errorMessage?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  onRetry?: () => void;
  className?: string;
}

type TxStatusComponent = React.ComponentType<TxStatusProps>;

/**
 * Status map: maps each transaction status to its dedicated component.
 * Keeps rendering logic flat and avoids complex conditional chains.
 */
export const TX_STATUS_COMPONENTS: Record<TxStatusValue, TxStatusComponent | null> = {
  idle: null,
  pending: TxStatusPending,
  confirmed: TxStatusConfirmed,
  failed: TxStatusFailed,
};

export const TxStatus: React.FC<TxStatusProps> = (props) => {
  const { status, className } = props;
  const StatusComponent = TX_STATUS_COMPONENTS[status];

  if (!StatusComponent) {
    return null;
  }

  return (
    <div className={className} data-testid={`tx-status-${status}`}>
      <StatusComponent {...props} />
    </div>
  );
};

export default TxStatus;