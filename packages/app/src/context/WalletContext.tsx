"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  isConnected,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api";

const STORAGE_KEY = "bc_wallet_address";

export class WalletNotConnectedError extends Error {
  constructor() {
    super("Wallet is not connected");
    this.name = "WalletNotConnectedError";
  }
}

export class FreighterNotInstalledError extends Error {
  constructor() {
    super("Freighter wallet extension not detected");
    this.name = "FreighterNotInstalledError";
  }
}

export interface WalletContextValue {
  publicKey: string | null;
  network: string | null;
  networkPassphrase: string | null;
  balance: string | null;
  networkWarning: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue>({
  publicKey: null,
  network: null,
  networkPassphrase: null,
  balance: null,
  networkWarning: false,
  isConnected: false,
  isConnecting: false,
  connect: async () => null,
  disconnect: () => {},
  signTransaction: async () => {
    throw new WalletNotConnectedError();
  },
});

async function fetchBalance(address: string): Promise<string | null> {
  try {
    const json = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`).then((r) => r.json());
    return json.balances?.find((b: { asset_type: string; balance: string }) => b.asset_type === "native")?.balance ?? null;
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Restore persisted connection on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    // Verify Freighter still has the address (extension may have been removed)
    isConnected()
      .then(async (res) => {
        if (!res.isConnected) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        const { address } = await getAddress();
        const { network: net, networkPassphrase: passphrase } = await getNetwork();
        if (address === stored) {
          setPublicKey(address);
          setNetwork(net);
          setNetworkPassphrase(passphrase);
          setBalance(await fetchBalance(address));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY));
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const connected = await isConnected();
      if (!connected.isConnected) {
        window.open("https://www.freighter.app", "_blank");
        return null;
      }
      await requestAccess();
      const { address } = await getAddress();
      const { network: net, networkPassphrase: passphrase } = await getNetwork();
      setPublicKey(address);
      setNetwork(net);
      setNetworkPassphrase(passphrase);
      setBalance(await fetchBalance(address));
      localStorage.setItem(STORAGE_KEY, address);
      return address;
    } catch (err) {
      console.error("[WalletContext] connect error:", err);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setNetwork(null);
    setNetworkPassphrase(null);
    setBalance(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const signTransaction = useCallback(
    async (xdr: string) => {
      const connected = await isConnected();
      if (!connected.isConnected) {
        throw new FreighterNotInstalledError();
      }
      if (!publicKey) {
        throw new WalletNotConnectedError();
      }
      const { signedTxXdr } = await freighterSignTransaction(xdr, {
        networkPassphrase: networkPassphrase ?? undefined,
        address: publicKey,
      });
      return signedTxXdr;
    },
    [publicKey, networkPassphrase]
  );

  const networkWarning = !!network && network !== "TESTNET";

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        network,
        networkPassphrase,
        balance,
        networkWarning,
        isConnected: !!publicKey,
        isConnecting,
        connect,
        disconnect,
        signTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
