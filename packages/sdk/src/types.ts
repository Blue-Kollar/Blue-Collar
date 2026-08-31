/** Re-export shared types from @bluecollar/types */
export type {
  AccountInfo,
  BroadcastResult,
  TxStatus,
  SdkConfig,
  WorkerRegistration,
  ReputationSync
} from '@bluecollar/types'

// SDK-specific types not shared elsewhere
export interface UnsignedTxParams {
  sourcePublicKey: string;
  destinationPublicKey: string;
  amount: string;
  memo: string;
  sequence: string;
}
