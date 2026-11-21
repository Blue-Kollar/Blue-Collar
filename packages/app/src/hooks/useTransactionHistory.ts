import { useQuery } from "@tanstack/react-query";
import { HORIZON_URL, MARKET_CONTRACT_ID } from "@/config/stellar";

const DEFAULT_LIMIT = 10;

interface HorizonPayment {
  id: string;
  paging_token: string;
  type: string;
  created_at: string;
  from?: string;
  to?: string;
  amount?: string;
  transaction_hash: string;
}

export interface HistoryItem {
  id: string;
  cursor: string;
  amount: string;
  recipient: string;
  date: string;
  hash: string;
}

interface HistoryResponse {
  items: HistoryItem[];
  nextCursor: string | null;
}

export function useTransactionHistory(publicKey: string, cursor: string | null) {
  return useQuery({
    queryKey: ["transaction-history", publicKey, cursor] as const,
    queryFn: async (): Promise<HistoryResponse> => {
      const url = new URL(`${HORIZON_URL}/accounts/${publicKey}/payments`);
      url.searchParams.set("order", "desc");
      url.searchParams.set("limit", String(DEFAULT_LIMIT + 1));
      if (cursor) url.searchParams.set("cursor", cursor);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Unable to load transaction history");

      const json = await response.json();
      const records = (json._embedded?.records ?? []) as HorizonPayment[];
      const payments = records.filter((record) =>
        record.type === "payment" && record.from === publicKey && !!record.to && !!record.amount &&
        (!MARKET_CONTRACT_ID || record.to === MARKET_CONTRACT_ID)
      );
      const items = payments.slice(0, DEFAULT_LIMIT).map((record) => ({
        id: record.id,
        cursor: record.paging_token,
        amount: record.amount ?? "0",
        recipient: record.to ?? "",
        date: record.created_at,
        hash: record.transaction_hash,
      }));

      return {
        items,
        nextCursor: payments.length > DEFAULT_LIMIT ? items.at(-1)?.cursor ?? null : null,
      };
    },
    enabled: !!publicKey,
  });
}