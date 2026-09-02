"use client";

import { QrCode } from "lucide-react";

import { useModal } from "@/context/ModalContext";

import QRCodeModal from "./QRCodeModal";

interface QRCodeButtonProps {
  workerName: string;
  workerId: string;
}

export default function QRCodeButton({ workerName, workerId }: QRCodeButtonProps) {
  const { openModal, closeModal } = useModal();
  const modalId = `qr-${workerId}`;

  const profileUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/workers/${workerId}`;

  const handleOpen = () => {
    openModal({
      id: modalId,
      ariaLabel: `Share ${workerName}'s profile via QR code`,
      content: (
        <QRCodeModal
          isOpen
          onClose={() => closeModal(modalId)}
          workerName={workerName}
          profileUrl={profileUrl}
        />
      ),
    });
  };

  return (
    <button
      onClick={handleOpen}
      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
      aria-label="Share via QR code"
      title="Share via QR code"
    >
      <QrCode size={18} className="text-gray-600" />
    </button>
  );
}
