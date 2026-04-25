"use client";

import {
  useState,
  useRef,
  useCallback,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Upload, X, RotateCw, FlipHorizontal, Crop, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  existingUrl?: string | null;
  onChange: (file: File | null, previewUrl: string | null) => void;
  className?: string;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export default function ImageUpload({ existingUrl, onChange, className }: Props) {
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (f: File) => {
      setError(null);
      if (!ACCEPT.includes(f.type)) {
        setError("Only JPG, PNG or WebP images are allowed.");
        return;
      }
      if (f.size > MAX_SIZE) {
        setError("File must be under 5 MB.");
        return;
      }
      const url = URL.createObjectURL(f);
      setFile(f);
      setPreview(url);
      setRotation(0);
      setFlipped(false);
      setCropRect(null);
      onChange(f, url);
    },
    [onChange]
  );

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const clear = () => {
    setFile(null);
    setPreview(existingUrl ?? null);
    setRotation(0);
    setFlipped(false);
    setCropRect(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange(null, existingUrl ?? null);
  };

  const rotate = () => {
    const next = (rotation + 90) % 360;
    setRotation(next);
    applyTransform(next, flipped);
  };

  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    applyTransform(rotation, next);
  };

  const applyTransform = (rot: number, flip: boolean) => {
    if (!imgRef.current || !canvasRef.current || !preview) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isRotated90 = rot === 90 || rot === 270;
    canvas.width = isRotated90 ? img.naturalHeight : img.naturalWidth;
    canvas.height = isRotated90 ? img.naturalWidth : img.naturalHeight;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    canvas.toBlob((blob) => {
      if (!blob) return;
      const newFile = new File([blob], file?.name ?? "image.jpg", { type: blob.type });
      const url = URL.createObjectURL(blob);
      setFile(newFile);
      setPreview(url);
      onChange(newFile, url);
    }, "image/jpeg");
  };

  const startCrop = () => setIsCropping(true);

  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropping) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCropStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setCropRect(null);
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropping || !cropStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(cropStart.x, e.clientX - rect.left);
    const y = Math.min(cropStart.y, e.clientY - rect.top);
    const w = Math.abs(e.clientX - rect.left - cropStart.x);
    const h = Math.abs(e.clientY - rect.top - cropStart.y);
    setCropRect({ x, y, w, h });
  };

  const handleCropMouseUp = () => {
    if (!isCropping) return;
    setCropStart(null);
  };

  const applyCrop = () => {
    if (!cropRect || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayRect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / displayRect.width;
    const scaleY = img.naturalHeight / displayRect.height;

    canvas.width = cropRect.w * scaleX;
    canvas.height = cropRect.h * scaleY;
    ctx.drawImage(
      img,
      cropRect.x * scaleX,
      cropRect.y * scaleY,
      cropRect.w * scaleX,
      cropRect.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const newFile = new File([blob], file?.name ?? "image.jpg", { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      setFile(newFile);
      setPreview(url);
      setCropRect(null);
      setIsCropping(false);
      onChange(newFile, url);
    }, "image/jpeg");
  };

  const fileSizeLabel = file
    ? file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Hidden canvas for transforms */}
      <canvas ref={canvasRef} className="hidden" />

      {preview ? (
        <div className="flex flex-col gap-3">
          {/* Image preview with crop overlay */}
          <div
            className={cn(
              "relative inline-block rounded-xl overflow-hidden border border-gray-200 select-none",
              isCropping && "cursor-crosshair"
            )}
            onMouseDown={handleCropMouseDown}
            onMouseMove={handleCropMouseMove}
            onMouseUp={handleCropMouseUp}
          >
            <img
              ref={imgRef}
              src={preview}
              alt="Preview"
              className="max-h-56 w-full object-contain bg-gray-50"
              draggable={false}
            />
            {/* Crop selection rect */}
            {isCropping && cropRect && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                style={{
                  left: cropRect.x,
                  top: cropRect.y,
                  width: cropRect.w,
                  height: cropRect.h,
                }}
              />
            )}
          </div>

          {/* File info */}
          {file && (
            <p className="text-xs text-gray-400">
              {file.name} · {fileSizeLabel}
            </p>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={rotate}
              title="Rotate 90°"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RotateCw size={13} /> Rotate
            </button>
            <button
              type="button"
              onClick={flip}
              title="Flip horizontal"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FlipHorizontal size={13} /> Flip
            </button>
            {!isCropping ? (
              <button
                type="button"
                onClick={startCrop}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Crop size={13} /> Crop
              </button>
            ) : (
              <button
                type="button"
                onClick={applyCrop}
                disabled={!cropRect}
                className="flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100 disabled:opacity-40 transition-colors"
              >
                <Check size={13} /> Apply crop
              </button>
            )}
            <button
              type="button"
              onClick={clear}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
            >
              <X size={13} /> Remove
            </button>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
          )}
        >
          <Upload size={24} className="text-gray-400" />
          <p className="text-sm font-medium text-gray-600">
            Drag & drop or <span className="text-blue-600">browse</span>
          </p>
          <p className="text-xs text-gray-400">JPG, PNG or WebP · max 5 MB</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={handleFileInput}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
