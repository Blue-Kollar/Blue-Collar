// Re-export from WalletContext so all consumers share the same state.
export {
  useWallet,
  WalletNotConnectedError,
  FreighterNotInstalledError,
} from "@/context/WalletContext";
import { useWallet } from "@/context/WalletContext";

export function useWalletNetworkWarning() {
  const { networkWarning, network } = useWallet();
  return { networkWarning, network };
}

/**
 * Selector hook — subscribes only to the wallet `balance` field.
 *
 * Use this in the balance widget instead of the full `useWallet()` hook so the
 * widget only re-renders when the balance value changes, not on every unrelated
 * wallet-state update (connect/disconnect, network change, etc.).
 *
 * Closes #1206
 */
export function useWalletBalance(): string | null {
  const { balance } = useWallet();
  return balance;
}

/**
 * Selector hook — subscribes only to wallet connection state fields needed to
 * render connect / disconnect affordances without pulling in balance or network
 * info that would cause unnecessary re-renders in pure connection-UI components.
 *
 * Closes #1206
 */
export function useWalletConnection() {
  const { publicKey, isConnected, isConnecting, connect, disconnect } = useWallet();
  return { publicKey, isConnected, isConnecting, connect, disconnect };
}
