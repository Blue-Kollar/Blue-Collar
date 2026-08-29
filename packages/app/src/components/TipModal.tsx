"use client";

import { useState } from "react";
import type { ReactNode, ChangeEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, CheckCircle2, AlertCircle, ExternalLink, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWallet, FreighterNotInstalledError, WalletNotConnectedError } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

const DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const SOROBAN_RPC = "https://soroban-testnet.stellar.org";
const STROOPS_PER_XLM = 10_000_000n;
const EXPLORER_BASE = "https://stellar.expert/explorer/testnet/tx";
const NETWORK_FEE = 0.00001;

type TxStatus = "idle" | "signing" | "pending" | "success" | "error";
type ErrorType = "freighter_missing" | "insufficient_balance" | "network_error" | "unknown";

interface Props {
  workerName: string;
  walletAddress: string;
  trigger?: ReactNode;
}

export default function TipModal({ workerName, walletAddress, trigger }: Props) {
  const t = useTranslations("tip");
  const { publicKey, networkPassphrase, connect, signTransaction } = useWallet();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("XLM");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);

  const reset = () => {
    setAmount("");
    setStatus("idle");
    setTxHash(null);
    setErrorMsg(null);
    setErrorType(null);
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) reset();
  };

  const total = amount ? (Number(amount) + NETWORK_FEE).toFixed(7) : "0";

  const sendTip = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

    setStatus("signing");
    setErrorMsg(null);
    setErrorType(null);

    // Tracked locally: `errorType` state read inside the catch below would be a
    // stale render-time value, which previously made every failure fall through
    // to the generic "unknown" branch.
    let failureType: ErrorType | null = null;

    try {
      let senderAddress = publicKey;
      if (!senderAddress) {
        senderAddress = await connect();
      }
      if (!senderAddress) {
        setErrorType("freighter_missing");
        setErrorMsg(t("freighterNotFound"));
        setStatus("error");
        return;
      }

      setStatus("pending");

      const passphrase = networkPassphrase ?? DEFAULT_NETWORK_PASSPHRASE;
      const amountInStroops = BigInt(Math.round(Number(amount) * Number(STROOPS_PER_XLM)));
      const txXdr = await buildTipTxXdr(senderAddress, walletAddress, amountInStroops, passphrase);

      const buildRes = await fetch(`${SOROBAN_RPC}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "simulateTransaction",
          params: { transaction: txXdr },
        }),
      });

      const simulation = await buildRes.json();
      if (simulation.error || simulation.result?.error) {
        const errMsg = simulation.error?.message ?? simulation.result?.error ?? "Simulation failed";
        failureType = errMsg.includes("insufficient")
          ? "insufficient_balance"
          : "network_error";
        throw new Error(errMsg);
      }

      const signedTxXdr = await signTransaction(txXdr);

      const submitRes = await fetch(`${HORIZON_URL}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `tx=${encodeURIComponent(signedTxXdr)}`,
      });

      const submitJson = await submitRes.json();
      if (!submitRes.ok) {
        throw new Error(submitJson.extras?.result_codes?.transaction ?? "Submission failed");
      }

      setTxHash(submitJson.hash);
      setStatus("success");
    } catch (err: unknown) {
      if (err instanceof FreighterNotInstalledError || err instanceof WalletNotConnectedError) {
        setErrorType("freighter_missing");
        setErrorMsg(t("freighterNotFound"));
        setStatus("error");
        return;
      }
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(msg);
      setErrorType(failureType ?? "unknown");
      setStatus("error");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            <Zap size={16} />
            {t("sendTip")}
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                {t("title")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("description", { name: workerName })}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t("ariaClose")}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-900">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">
                {t("recipient")}
              </p>
              <p className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all">
                {walletAddress}
              </p>
            </div>

            {(status === "idle" || status === "signing") && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    {t("amount")}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.0000001"
                      step="0.1"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                      disabled={status === "signing"}
                      aria-label={t("amountLabel", { token: selectedToken })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 pr-16 text-lg font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-gray-500 dark:text-gray-400">
                      {selectedToken}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    {t("token")}
                  </label>
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    disabled={status === "signing"}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="XLM">{t("tokenXlm")}</option>
                    <option value="USDC">{t("tokenUsdc")}</option>
                  </select>
                </div>

                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t("amount")}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{amount || "0"} {selectedToken}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t("networkFee")}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{NETWORK_FEE.toFixed(7)} {selectedToken}</span>
                  </div>
                  <div className="h-px bg-gray-200 dark:bg-gray-700" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-900 dark:text-white">{t("total")}</span>
                    <span className="text-blue-600 dark:text-blue-400">{total} {selectedToken}</span>
                  </div>
                </div>
              </>
            )}

            {status === "signing" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-950 animate-pulse" />
                  <Loader2 size={32} className="absolute inset-0 m-auto animate-spin text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{t("waitingForSignature")}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("pleaseConfirm")}</p>
                </div>
              </div>
            )}

            {status === "pending" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-950 animate-pulse" />
                  <Loader2 size={32} className="absolute inset-0 m-auto animate-spin text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{t("processing")}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("broadcasting")}</p>
                </div>
              </div>
            )}

            {status === "success" && txHash && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-950" />
                  <CheckCircle2 size={40} className="absolute inset-0 m-auto text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-900 dark:text-white">{t("successTitle")}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("successDescription", { name: workerName })}</p>
                </div>
                <a
                  href={`${EXPLORER_BASE}/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors border border-green-200 dark:border-green-900"
                >
                  {t("viewOnExplorer")}
                  <ExternalLink size={14} />
                </a>
                <p className="font-mono text-xs text-gray-400 dark:text-gray-500 break-all max-w-xs">
                  {txHash}
                </p>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full bg-red-100 dark:bg-red-950" />
                  <AlertCircle size={40} className="absolute inset-0 m-auto text-red-600 dark:text-red-400" />
                </div>

                {errorType === "freighter_missing" ? (
                  <>
                    <div>
                      <p className="font-bold text-lg text-gray-900 dark:text-white">{t("freighterNotFound")}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("freighterDescription")}</p>
                    </div>
                    <a
                      href="https://www.freighter.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
                    >
                      {t("downloadFreighter")}
                      <ExternalLink size={14} />
                    </a>
                  </>
                ) : errorType === "insufficient_balance" ? (
                  <>
                    <div>
                      <p className="font-bold text-lg text-gray-900 dark:text-white">{t("insufficientBalance")}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("insufficientBalanceDesc", { token: selectedToken })}</p>
                    </div>
                    <button
                      onClick={reset}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t("tryDifferentAmount")}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-bold text-lg text-gray-900 dark:text-white">{t("transactionFailed")}</p>
                      {errorMsg && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 border border-red-200 dark:border-red-900">
                          {errorMsg}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={reset}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t("tryAgain")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {(status === "idle" || status === "signing") && (
            <div className="mt-6 flex gap-3">
              <Dialog.Close className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                {t("cancel")}
              </Dialog.Close>
              <button
                onClick={sendTip}
                disabled={!amount || Number(amount) <= 0 || status === "signing"}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                  !amount || Number(amount) <= 0 || status === "signing"
                    ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800"
                )}
              >
                {status === "signing" ? t("signing") : t("sendTip")}
              </button>
            </div>
          )}

          {status === "success" && (
            <div className="mt-6">
              <Dialog.Close className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {t("close")}
              </Dialog.Close>
            </div>
          )}

          {status === "error" && (
            <div className="mt-6">
              <Dialog.Close className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {t("close")}
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

async function buildTipTxXdr(
  from: string,
  to: string,
  amountStroops: bigint,
  networkPassphrase: string
): Promise<string> {
  const StellarSdk = await import("@stellar/stellar-sdk");
  const { Server, TransactionBuilder, Operation, Asset, BASE_FEE } = StellarSdk;

  const server = new Server(HORIZON_URL);
  const account = await server.loadAccount(from);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: to,
        asset: Asset.native(),
        amount: (Number(amountStroops) / 1e7).toFixed(7),
      })
    )
    .setTimeout(180)
    .build();

  return tx.toXDR();
}
