import { useMutation } from "@tanstack/react-query";
import { HORIZON_URL } from "@/config/stellar";

interface SubmissionResponse {
  hash: string;
  extras?: { result_codes?: { transaction?: string } };
}

export function useTipSubmission() {
  return useMutation({
    mutationFn: async (signedTransactionXdr: string) => {
      const response = await fetch(`${HORIZON_URL}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `tx=${encodeURIComponent(signedTransactionXdr)}`,
      });
      const result = await response.json() as SubmissionResponse;
      if (!response.ok) {
        throw new Error(result.extras?.result_codes?.transaction ?? "Submission failed");
      }
      return result;
    },
  });
}