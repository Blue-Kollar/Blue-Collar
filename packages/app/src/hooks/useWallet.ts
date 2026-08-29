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
