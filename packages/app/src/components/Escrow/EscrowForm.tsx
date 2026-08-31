"use client";

import { useState } from "react";
import { validateEscrowForm } from "@/utils/validation";

interface EscrowFormData {
  amount: string;
  token: string;
  counterparty: string;
  terms: string;
}

interface EscrowFormProps {
  onSubmit: (data: EscrowFormData) => void;
  disabled?: boolean;
}

export default function EscrowForm({ onSubmit, disabled }: EscrowFormProps) {
  const [form, setForm] = useState<EscrowFormData>({ amount: "", token: "XLM", counterparty: "", terms: "" });
  const [errors, setErrors] = useState<Partial<EscrowFormData>>({});

  function validate(): boolean {
    const e = validateEscrowForm(form);
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onSubmit(form);
  }

  const set = (field: keyof EscrowFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input
            id="amount"
            type="number"
            min="0"
            step="any"
            value={form.amount}
            onChange={set("amount")}
            disabled={disabled}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            placeholder="0.00"
          />
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
        </div>
        <div>
          <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">Token</label>
          <select
            id="token"
            value={form.token}
            onChange={set("token")}
            disabled={disabled}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="XLM">XLM</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="counterparty" className="block text-sm font-medium text-gray-700 mb-1">Counterparty Address</label>
        <input
          id="counterparty"
          type="text"
          value={form.counterparty}
          onChange={set("counterparty")}
          disabled={disabled}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          placeholder="G..."
        />
        {errors.counterparty && <p className="mt-1 text-xs text-red-600">{errors.counterparty}</p>}
      </div>

      <div>
        <label htmlFor="terms" className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
        <textarea
          id="terms"
          value={form.terms}
          onChange={set("terms")}
          disabled={disabled}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          placeholder="Describe the work and conditions for release..."
        />
        {errors.terms && <p className="mt-1 text-xs text-red-600">{errors.terms}</p>}
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Create Escrow
      </button>
    </form>
  );
}
