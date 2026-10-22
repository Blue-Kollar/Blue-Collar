import { useMutation } from "@tanstack/react-query";
import { SOROBAN_RPC_URL } from "@/config/stellar";

interface SimulationResponse {
  error?: { message?: string };
  result?: { error?: string };
}

export function useTipSimulation() {
  return useMutation({
    mutationFn: async (transactionXdr: string) => {
      const response = await fetch(SOROBAN_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "simulateTransaction",
          params: { transaction: transactionXdr },
        }),
      });
      const simulation = await response.json() as SimulationResponse;
      const message = simulation.error?.message ?? simulation.result?.error;
      if (!response.ok || message) throw new Error(message ?? "Simulation failed");
      return simulation;
    },
  });
}