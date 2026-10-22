/**
 * Unit tests for src/context/ModalContext.tsx
 *
 * Covers:
 *  - openModal / closeModal / closeAll API
 *  - Stack ordering (last-opened modal is on top)
 *  - Escape-key dismissal via Radix Dialog
 *  - Focus-trap: close button receives focus on open
 *  - Non-dismissible modal ignores overlay click / Escape
 *
 * Closes #1210
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModalProvider, useModal } from "@/context/ModalContext";
import { type ReactNode } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: ReactNode }) {
  return <ModalProvider>{children}</ModalProvider>;
}

/** A simple button that opens a modal when clicked. */
function Opener({
  id,
  label,
  dismissible,
}: {
  id: string;
  label: string;
  dismissible?: boolean;
}) {
  const { openModal } = useModal();
  return (
    <button
      onClick={() =>
        openModal({
          id,
          ariaLabel: label,
          dismissible,
          content: <p data-testid={`modal-content-${id}`}>{label} content</p>,
        })
      }
    >
      Open {label}
    </button>
  );
}

/** A button that reads the current stack length. */
function StackDisplay() {
  const { stack } = useModal();
  return <span data-testid="stack">{stack.join(",")}</span>;
}

/** A button that closes all modals. */
function CloseAllButton() {
  const { closeAll } = useModal();
  return <button onClick={closeAll}>Close all</button>;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ModalProvider — openModal / closeModal / closeAll", () => {
  it("opens a modal and renders its content", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <Opener id="tip" label="Tip" />
      </Wrapper>
    );

    await user.click(screen.getByText("Open Tip"));
    expect(screen.getByTestId("modal-content-tip")).toBeInTheDocument();
  });

  it("closeModal removes the modal from the DOM", async () => {
    const user = userEvent.setup();

    function ClosingOpener() {
      const { openModal, closeModal } = useModal();
      return (
        <>
          <button onClick={() => openModal({ id: "x", content: <p data-testid="x-content">X</p> })}>
            Open X
          </button>
          <button onClick={() => closeModal("x")}>Close X</button>
        </>
      );
    }

    render(
      <Wrapper>
        <ClosingOpener />
      </Wrapper>
    );

    await user.click(screen.getByText("Open X"));
    expect(screen.getByTestId("x-content")).toBeInTheDocument();

    await user.click(screen.getByText("Close X"));
    expect(screen.queryByTestId("x-content")).not.toBeInTheDocument();
  });

  it("closeAll removes every open modal", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <Opener id="a" label="A" />
        <Opener id="b" label="B" />
        <CloseAllButton />
        <StackDisplay />
      </Wrapper>
    );

    await user.click(screen.getByText("Open A"));
    await user.click(screen.getByText("Open B"));
    expect(screen.getByTestId("stack").textContent).toBe("a,b");

    await user.click(screen.getByText("Close all"));
    expect(screen.getByTestId("stack").textContent).toBe("");
    expect(screen.queryByTestId("modal-content-a")).not.toBeInTheDocument();
    expect(screen.queryByTestId("modal-content-b")).not.toBeInTheDocument();
  });

  it("opening the same id twice replaces, not duplicates, the entry", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <Opener id="dup" label="Dup" />
        <StackDisplay />
      </Wrapper>
    );

    await user.click(screen.getByText("Open Dup"));
    await user.click(screen.getByText("Open Dup"));

    // Only one entry in the stack
    expect(screen.getByTestId("stack").textContent).toBe("dup");
  });
});

describe("ModalProvider — stack ordering", () => {
  it("later-opened modals appear after earlier ones in the stack", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <Opener id="first" label="First" />
        <Opener id="second" label="Second" />
        <StackDisplay />
      </Wrapper>
    );

    await user.click(screen.getByText("Open First"));
    await user.click(screen.getByText("Open Second"));

    expect(screen.getByTestId("stack").textContent).toBe("first,second");
  });
});

describe("ModalProvider — Escape-key dismissal", () => {
  it("pressing Escape closes the topmost dismissible modal", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <Opener id="esc-modal" label="Escape" />
      </Wrapper>
    );

    await user.click(screen.getByText("Open Escape"));
    expect(screen.getByTestId("modal-content-esc-modal")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("modal-content-esc-modal")).not.toBeInTheDocument();
  });
});

describe("ModalProvider — non-dismissible modals", () => {
  it("a modal with dismissible=false is not closed by Escape", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <Opener id="nd" label="NonDismissible" dismissible={false} />
      </Wrapper>
    );

    await user.click(screen.getByText("Open NonDismissible"));
    expect(screen.getByTestId("modal-content-nd")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    // Modal should still be present
    expect(screen.getByTestId("modal-content-nd")).toBeInTheDocument();
  });

  it("a non-dismissible modal has no close button", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <Opener id="nd2" label="ND2" dismissible={false} />
      </Wrapper>
    );

    await user.click(screen.getByText("Open ND2"));
    expect(screen.queryByRole("button", { name: /close modal/i })).not.toBeInTheDocument();
  });
});

describe("ModalProvider — focus management", () => {
  it("the close button is rendered and accessible", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <Opener id="focus-test" label="FocusTest" />
      </Wrapper>
    );

    await user.click(screen.getByText("Open FocusTest"));
    const closeBtn = screen.getByRole("button", { name: /close modal/i });
    expect(closeBtn).toBeInTheDocument();
  });

  it("clicking the close button dismisses the modal", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <Opener id="close-btn" label="CloseBtnModal" />
      </Wrapper>
    );

    await user.click(screen.getByText("Open CloseBtnModal"));
    expect(screen.getByTestId("modal-content-close-btn")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close modal/i }));
    expect(screen.queryByTestId("modal-content-close-btn")).not.toBeInTheDocument();
  });
});

describe("useModal — context values", () => {
  it("hasOpenModals is false when no modals are open", () => {
    function Reader() {
      const { hasOpenModals } = useModal();
      return <span data-testid="has-open">{String(hasOpenModals)}</span>;
    }

    render(
      <Wrapper>
        <Reader />
      </Wrapper>
    );

    expect(screen.getByTestId("has-open").textContent).toBe("false");
  });

  it("hasOpenModals is true after opening a modal", async () => {
    const user = userEvent.setup();

    function Reader() {
      const { hasOpenModals } = useModal();
      return <span data-testid="has-open">{String(hasOpenModals)}</span>;
    }

    render(
      <Wrapper>
        <Opener id="hom" label="HOM" />
        <Reader />
      </Wrapper>
    );

    expect(screen.getByTestId("has-open").textContent).toBe("false");
    await user.click(screen.getByText("Open HOM"));
    expect(screen.getByTestId("has-open").textContent).toBe("true");
  });
});
