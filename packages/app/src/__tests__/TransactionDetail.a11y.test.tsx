/**
 * TransactionConfirmDialog (the pre-signing transaction detail view) —
 * accessibility regression tests.
 *
 * Runs axe-core (WCAG 2.1 AA + best-practice) over the open dialog in each of
 * its states, and asserts the semantics, keyboard navigation and focus
 * management added for #972.
 *
 * Note: axe's colour-contrast rule cannot run under jsdom — no layout, and
 * vitest is configured with `css: false` so the Tailwind classes never resolve.
 * The contrast fixes here were verified by computing the ratios directly.
 *
 * Closes #972
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll } from "vitest";
import axe from "axe-core";
import TransactionConfirmDialog from "@/components/Payment/TransactionConfirmDialog";
import type { TransactionSummary } from "@/lib/transactions";

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Icon = ({ "aria-hidden": hidden }: React.AriaAttributes) => (
    <span aria-hidden={hidden ?? true} />
  );
  const mock: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    mock[key] = typeof actual[key] === "function" ? Icon : actual[key];
  }
  return mock;
});

// jsdom has no canvas; axe probes it while attempting colour-contrast checks.
beforeAll(() => {
  if (typeof HTMLCanvasElement !== "undefined") {
    HTMLCanvasElement.prototype.getContext =
      vi.fn() as unknown as typeof HTMLCanvasElement.prototype.getContext;
  }
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const paymentSummary: TransactionSummary = {
  type: "payment",
  from: "GSOURCE123",
  to: "GDEST456",
  amountDisplay: "10.0000000 XLM",
  networkName: "TESTNET",
  networkPassphrase: "Test SDF Network ; September 2015",
  fee: "0.0000100 XLM",
  operations: [
    { type: "payment", description: "Pay 10.0000000 XLM to GDEST456" },
    { type: "payment", description: "Pay the network fee" },
  ],
};

const contractSummary: TransactionSummary = {
  ...paymentSummary,
  type: "contract_call",
  to: "",
  amountDisplay: "",
  operations: [{ type: "contract_call", description: "Invoke smart contract function" }],
};

function renderDialog(props: Partial<React.ComponentProps<typeof TransactionConfirmDialog>> = {}) {
  return render(
    <TransactionConfirmDialog
      open
      summary={paymentSummary}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );
}

// ─── axe helpers ──────────────────────────────────────────────────────────────

async function runAxe(container: Element) {
  const results = await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
    },
  });
  return results.violations;
}

function formatViolations(violations: axe.Result[]): string {
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.description}\n  Nodes: ${v.nodes.map((n) => n.html).join(", ")}`,
    )
    .join("\n");
}

async function expectDialogHasNoViolations(
  props: Partial<React.ComponentProps<typeof TransactionConfirmDialog>> = {},
) {
  renderDialog(props);
  const dialog = await screen.findByRole("dialog");
  const violations = await runAxe(dialog);
  expect(violations, formatViolations(violations)).toHaveLength(0);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TransactionConfirmDialog — axe", () => {
  it("has no violations for a payment summary", async () => {
    await expectDialogHasNoViolations();
  });

  it("has no violations for a contract call", async () => {
    await expectDialogHasNoViolations({ summary: contractSummary });
  });

  it("has no violations while the summary is loading", async () => {
    await expectDialogHasNoViolations({ summary: null });
  });

  it("has no violations with the network warning shown", async () => {
    await expectDialogHasNoViolations({ networkWarning: true });
  });
});

describe("TransactionConfirmDialog — semantics", () => {
  it("associates each detail value with its label via a description list", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");

    const terms = within(dialog).getAllByRole("term").map((el) => el.textContent);
    expect(terms).toEqual(["Network", "To", "Amount", "Network fee"]);

    const definitions = within(dialog).getAllByRole("definition").map((el) => el.textContent);
    expect(definitions).toEqual([
      "TESTNET",
      "GDEST456",
      "10.0000000 XLM",
      "0.0000100 XLM",
    ]);
  });

  it("swaps in the Action row for contract calls", async () => {
    renderDialog({ summary: contractSummary });
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getAllByRole("term").map((el) => el.textContent)).toEqual([
      "Network",
      "Action",
      "Network fee",
    ]);
  });

  it("exposes the operations as a labelled list", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");

    const list = within(dialog).getByRole("list", { name: "Operations (2)" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Pay 10.0000000 XLM to GDEST456");
  });

  it("announces the loading placeholder politely", async () => {
    renderDialog({ summary: null });

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Loading transaction details…");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("gives the icon-only close control a name distinct from Cancel", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByRole("button", { name: "Close transaction details" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("points the blocked confirm button at the reason it is blocked", async () => {
    const { unmount } = renderDialog({ networkWarning: true });
    let confirm = await screen.findByTestId("confirm-sign-btn");
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription(/different network/i);
    unmount();

    renderDialog({ summary: null });
    confirm = await screen.findByTestId("confirm-sign-btn");
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription(/loading transaction details/i);
  });

  it("leaves the confirm button undescribed once it is usable", async () => {
    renderDialog();
    const confirm = await screen.findByTestId("confirm-sign-btn");
    expect(confirm).toBeEnabled();
    expect(confirm).not.toHaveAttribute("aria-describedby");
  });
});

describe("TransactionConfirmDialog — keyboard and focus", () => {
  it("moves focus into the dialog when it opens", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("traps Tab within the dialog and keeps DOM order", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await screen.findByRole("dialog");

    const close = within(dialog).getByRole("button", { name: "Close transaction details" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: /sign & submit/i });

    close.focus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    // Wraps back into the dialog rather than escaping to the page behind it.
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("activates Cancel and Sign & Submit from the keyboard", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderDialog({ onCancel, onConfirm });
    const dialog = await screen.findByRole("dialog");

    within(dialog).getByRole("button", { name: "Cancel" }).focus();
    await user.keyboard("{Enter}");
    expect(onCancel).toHaveBeenCalledOnce();

    within(dialog).getByRole("button", { name: /sign & submit/i }).focus();
    await user.keyboard(" ");
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cancels on Escape", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("keeps the blocked confirm button out of the tab order", async () => {
    const user = userEvent.setup();
    renderDialog({ networkWarning: true });
    const dialog = await screen.findByRole("dialog");

    within(dialog).getByRole("button", { name: "Close transaction details" }).focus();
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("confirm-sign-btn")).not.toHaveFocus();
  });
});
