import { useMutation } from "@tanstack/react-query";
import { FRIENDBOT_URL } from "@/config/stellar";

export function useFriendbotFunding() {
  return useMutation({
    mutationFn: async (walletAddress: string) => {
      const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(walletAddress)}`);
      if (!response.ok) throw new Error("Friendbot funding failed.");
      return walletAddress;
    },
  });
}