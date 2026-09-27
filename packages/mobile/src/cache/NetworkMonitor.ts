import { useEffect, useRef, useCallback } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { cacheStore } from "./CacheStore";
import { NetworkState } from "./types";

export interface UseNetworkMonitorOptions {
  onReconnect?: () => void | Promise<void>;
  onDisconnect?: () => void;
  autoSyncOnReconnect?: boolean;
}

export const useNetworkMonitor = (options: UseNetworkMonitorOptions = {}) => {
  const { onReconnect, onDisconnect, autoSyncOnReconnect = true } = options;
  const previousState = useRef<NetworkState | null>(null);
  const isInitialMount = useRef(true);

  const handleNetworkChange = useCallback(
    (state: NetInfoState) => {
      const networkState: NetworkState = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        lastConnected: state.isConnected ? Date.now() : previousState.current?.lastConnected ?? null,
      };
      const wasConnected = previousState.current?.isConnected ?? false;
      cacheStore.setNetworkState(networkState);
      if (isInitialMount.current) {
        isInitialMount.current = false;
        previousState.current = networkState;
        return;
      }
      if (!wasConnected && state.isConnected) {
        if (autoSyncOnReconnect) cacheStore.processQueue().then(() => onReconnect?.());
        else onReconnect?.();
      }
      if (wasConnected && !state.isConnected) {
        cacheStore.setSyncStatus("offline");
        onDisconnect?.();
      }
      previousState.current = networkState;
    },
    [onReconnect, onDisconnect, autoSyncOnReconnect]
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    NetInfo.fetch().then((state) => handleNetworkChange(state));
    return () => unsubscribe();
  }, [handleNetworkChange]);

  return {
    isConnected: previousState.current?.isConnected ?? false,
    isInternetReachable: previousState.current?.isInternetReachable ?? null,
    isOffline: cacheStore.isOffline(),
    syncStatus: cacheStore.getSyncStatus(),
    pendingActionsCount: cacheStore.getPendingActionsCount(),
  };
};