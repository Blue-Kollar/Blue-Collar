"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface DeleteWorkerDialogProps {
  workerName: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

/**
 * Confirmation dialog shown before permanently deleting a worker listing.
 */
export function DeleteWorkerDialog({
  workerName,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteWorkerDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <Dialog.Title className="font-semibold text-gray-900 dark:text-gray-100">
                  Delete worker?
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-gray-500">
                  This will permanently remove{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {workerName}
                  </span>
                  . This action cannot be undone.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close aria-label="Close" className="rounded-md p-1 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="mt-5 flex gap-3">
            <Dialog.Close className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Cancel
            </Dialog.Close>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {isDeleting && <Loader2 size={14} className="animate-spin" />}
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
