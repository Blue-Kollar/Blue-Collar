"use client";

/**
 * ModalProvider — centralised modal management
 *
 * Replaces scattered `useState(false)` / `isOpen` patterns with a single
 * context that:
 *  - Maintains a stack of open modals so they can be layered.
 *  - Exposes `openModal` / `closeModal` / `closeAll` APIs.
 *  - Renders each modal at portal level, guaranteeing correct stacking
 *    and z-index without callers needing to manage it.
 *  - Handles focus-trap and Escape-key dismissal via Radix Dialog.
 *
 * Closes #1210
 *
 * Usage:
 * ```tsx
 * // 1. Wrap your app (already done in layout.tsx)
 * <ModalProvider>…</ModalProvider>
 *
 * // 2. Open a modal from any component
 * const { openModal, closeModal } = useModal();
 * openModal("qr", <QRCodeModal workerName="Jane" profileUrl="…" />);
 *
 * // 3. Close from inside a modal
 * const { closeModal } = useModal();
 * closeModal("qr");
 * ```
 */

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalEntry {
  /** Stable key used to reference this modal (e.g. "tip", "qr", "contact"). */
  id: string;
  /** The React subtree to render inside the dialog. */
  content: ReactNode;
  /** Optional ARIA label for the dialog (falls back to the id). */
  ariaLabel?: string;
  /** When false the modal cannot be dismissed by clicking the overlay or
   *  pressing Escape.  Default: true. */
  dismissible?: boolean;
}

export interface ModalContextValue {
  /** Open a modal, pushing it onto the stack.  Replaces an existing entry
   *  with the same id to avoid duplicates. */
  openModal: (entry: ModalEntry) => void;
  /** Close the modal with the given id. */
  closeModal: (id: string) => void;
  /** Close every open modal. */
  closeAll: () => void;
  /** Whether any modal is currently open. */
  hasOpenModals: boolean;
  /** The ids of all currently open modals, bottom → top. */
  stack: string[];
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ModalContext = createContext<ModalContextValue>({
  openModal: () => {},
  closeModal: () => {},
  closeAll: () => {},
  hasOpenModals: false,
  stack: [],
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<ModalEntry[]>([]);

  const openModal = useCallback((entry: ModalEntry) => {
    setModals((prev) => {
      // Replace any existing entry with the same id
      const without = prev.filter((m) => m.id !== entry.id);
      return [...without, entry];
    });
  }, []);

  const closeModal = useCallback((id: string) => {
    setModals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const closeAll = useCallback(() => {
    setModals([]);
  }, []);

  const stack = modals.map((m) => m.id);

  return (
    <ModalContext.Provider
      value={{
        openModal,
        closeModal,
        closeAll,
        hasOpenModals: modals.length > 0,
        stack,
      }}
    >
      {children}

      {/* Render each modal in z-index order (last in stack = highest z). */}
      {modals.map((modal, index) => (
        <ManagedModal
          key={modal.id}
          entry={modal}
          onClose={() => closeModal(modal.id)}
          zIndex={50 + index * 10}
        />
      ))}
    </ModalContext.Provider>
  );
}

// ─── ManagedModal ─────────────────────────────────────────────────────────────

interface ManagedModalProps {
  entry: ModalEntry;
  onClose: () => void;
  zIndex: number;
}

function ManagedModal({ entry, onClose, zIndex }: ManagedModalProps) {
  const { id, content, ariaLabel, dismissible = true } = entry;
  const titleId = `modal-title-${id}`;
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open && dismissible) onClose();
  };

  return (
    <DialogPrimitive.Root open onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          style={{ zIndex }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />

        {/* Content wrapper */}
        <DialogPrimitive.Content
          aria-labelledby={titleId}
          style={{ zIndex: zIndex + 1 }}
          className={cn(
            "fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl bg-white dark:bg-gray-900 shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "focus:outline-none"
          )}
          onOpenAutoFocus={(e) => {
            // Move focus to the close button by default for predictable
            // keyboard navigation.
            e.preventDefault();
            firstFocusRef.current?.focus();
          }}
        >
          {/* Visually hidden title for screen readers */}
          <DialogPrimitive.Title id={titleId} className="sr-only">
            {ariaLabel ?? id}
          </DialogPrimitive.Title>

          {/* Close button */}
          {dismissible && (
            <DialogPrimitive.Close
              ref={firstFocusRef}
              aria-label="Close modal"
              className={cn(
                "absolute right-4 top-4 rounded-lg p-1.5",
                "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              )}
            >
              <X size={18} aria-hidden="true" />
            </DialogPrimitive.Close>
          )}

          {/* Consumer content */}
          <div className="p-6">{content}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Access the modal management API from any component. */
export function useModal(): ModalContextValue {
  return useContext(ModalContext);
}

// Re-export a convenience hook for generating stable modal ids in components
// that open a single modal type.
export function useModalId(prefix?: string): string {
  const id = useId();
  return prefix ? `${prefix}-${id}` : id;
}
