"use client";

import { Download, X } from "lucide-react";
import QRCode from "qrcode.react";
import { useRef,useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerName: string;
  profileUrl: string;
}

export default function QRCodeModal({
  isOpen,
  onClose,
  workerName,
  profileUrl,
}: QRCodeModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQRCode = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${workerName}-profile-qr.png`;
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {workerName}'s Profile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <div ref={qrRef} className="p-4 bg-white rounded-lg border">
            <QRCode value={profileUrl} size={256} level="H" includeMargin />
          </div>

          <p className="text-sm text-gray-600 text-center">
            Scan this QR code to view {workerName}'s profile
          </p>

          <Button
            onClick={downloadQRCode}
            className="w-full gap-2"
            variant="default"
          >
            <Download size={16} />
            Download QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
