"use client";

import { useState } from "react";
import type { ReactNode, ChangeEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import { cn } from "@/lib/utils";

// ─── Stellar / Soroban constants ────────────────────────────────────────────
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const SOROBAN_RPC = "https://soroban-testnet.stellar.org";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for Soroban contract path
const MARKET_CONTRACT_ID = process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID ?? "";
// XLM native asset contract on testnet — reserved for future Soroban path
// const XLM_TOKEN_CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const STROOPS_PER_XLM = 10_000_000n;
const EXPLORER_BASE = "https://stellar.expert/explorer/testnet/tx";

type TxStatus = "idle" | "pending" | "success" | "error";

interface Props {
  workerName: string;
  walletAddress: string;
  trigger?: ReactNode;
}

export default function TipModal({ workerName, walletAddress, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [freighterMissing, setFreighterMissing] = useState(false);

  const reset = () => {
    setAmount("");
    setStatus("idle");
    setTxHash(null);
    setErrorMsg(null);
    setFreighterMissing(false);
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) reset();
  };

  const sendTip = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

    setStatus("pending");
    setErrorMsg(null);

    try {
      // 1. Check Freighter is installed
      const connected = await isConnected();
      if (!connected.isConnected) {
        setFreighterMissing(true);
        setStatus("error");
        return;
      }

      // 2. Request wallet access & get public key
      await requestAccess();
      const { address: senderAddress } = await getAddress();

      // 3. Build the Soroban transaction via RPC
      const amountInStroops = BigInt(Math.round(Number(amount) * Number(STROOPS_PER_XLM)));

      const buildRes = await fetch(`${SOROBAN_RPC}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "simulateTransaction",
          params: {
            transaction: await buildTipTxXdr(
              senderAddress,
              walletAddress,
              amountInStroops
            ),
          },
        }),
      });

      const simulation = await buildRes.json();
      if (simulation.error || simulation.result?.error) {
        throw new Error(simulation.error?.message ?? simulation.result?.error ?? "Simulation failed");
      }

      // 4. Assemble the real transaction with simulation footprint
      const assembledXdr = await assembleTipTx(
        senderAddress,
        walletAddress,
        amountInStroops,
        simulation.result
      );

      // 5. Sign with Freighter
      const { signedTxXdr } = await signTransaction(assembledXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      // 6. Submit to Horizon
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
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  const isLoading = status === "pending";

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Send Tip
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Send a Tip
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-gray-500">
                Send XLM directly to {workerName}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            {/* Worker wallet address */}
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Worker Wallet
              </p>
              <p className="rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 break-all border">
                {walletAddress}
              </p>
            </div>

            {/* Amount input */}
            {status === "idle" && (
              <div>
                <label
                  htmlFor="tip-amount"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Amount (XLM)
                </label>
                <div className="relative">
                  <input
                    id="tip-amount"
                    type="number"
                    min="0.0000001"
                    step="0.1"
                    placeholder="e.g. 5"
                    value={amount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 pr-14 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                    XLM
                  </span>
                </div>
              </div>
            )}

            {/* Pending */}
            {status === "pending" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Loader2 size={32} className="animate-spin text-blue-500" />
                <p className="text-sm text-gray-600">
                  Waiting for wallet confirmation…
                </p>
              </div>
            )}

            {/* Success */}
            {status === "success" && txHash && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 size={32} className="text-green-500" />
                <p className="text-sm font-medium text-gray-800">Tip sent successfully!</p>
                <a
                  href={`${EXPLORER_BASE}/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                >
                  View on Stellar Expert
                  <ExternalLink size={12} />
                </a>
                <p className="font-mono text-xs text-gray-400 break-all">{txHash}</p>
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <AlertCircle size={32} className="text-red-500" />
                {freighterMissing ? (
                  <>
                    <p className="text-sm font-medium text-gray-800">Freighter not installed</p>
                    <p className="text-xs text-gray-500">
                      You need the Freighter browser extension to send tips.
                    </p>
                    <a
                      href="https://www.freighter.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      Download Freighter
                      <ExternalLink size={13} />
                    </a>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-800">Transaction failed</p>
                    {errorMsg && (
                      <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 break-all">
                        {errorMsg}
                      </p>
                    )}
                    <button
                      onClick={reset}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Try again
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {status === "idle" && (
            <div className="mt-6 flex gap-3">
              <Dialog.Close className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </Dialog.Close>
              <button
                onClick={sendTip}
                disabled={!amount || Number(amount) <= 0 || isLoading}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors",
                  !amount || Number(amount) <= 0
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                Send Tip
              </button>
            </div>
          )}

          {status === "success" && (
            <div className="mt-6">
              <Dialog.Close className="w-full rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
                Close
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Stellar transaction helpers ────────────────────────────────────────────
// These build the XDR for the Market contract's `tip` function call.
// We use the Stellar base library via dynamic import to keep bundle size down.

async function buildTipTxXdr(
  from: string,
  to: string,
  amountStroops: bigint
): Promise<string> {
  const StellarSdk = await import("@stellar/stellar-sdk");
  const { Keypair: _Keypair, TransactionBuilder, Networks: _Networks, Operation, Asset, BASE_FEE } = StellarSdk;

  const server = new StellarSdk.Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(from);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
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

async function assembleTipTx(
  from: string,
  to: string,
  amountStroops: bigint,
  _simulationResult: unknown
): Promise<string> {
  // For a native XLM payment (non-Soroban path), the "assembled" tx is the same.
  // If MARKET_CONTRACT_ID is set, this would use SorobanRpc.assembleTransaction.
  return buildTipTxXdr(from, to, amountStroops);
}
