import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cacheStore } from "../cache";
import { OfflineBanner } from "../cache/OfflineBanner";

cacheStore.setNetworkState({ isConnected: true, isInternetReachable: null, lastConnected: Date.now() });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="worker/[id]" options={{ headerShown: true, title: "Worker Profile" }} />
        <Stack.Screen name="auth/login" options={{ headerShown: true, title: "Login" }} />
        <Stack.Screen name="auth/register" options={{ headerShown: true, title: "Register" }} />
      </Stack>
    </QueryClientProvider>
  );
}