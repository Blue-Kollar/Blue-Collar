"use client";

import { useState, useCallback } from "react";
import { isConnected, getAddress, requestAccess } from "@stellar/freighter-api";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const connected = await isConnected();
      if (!connected) {
        alert("Freighter wallet not found. Please install the extension.");
        return;
      }
      await requestAccess();
      const { address: addr } = await getAddress();
      setAddress(addr);
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(false);
    }
  }, []);

  return { address, connecting, connect };
}
