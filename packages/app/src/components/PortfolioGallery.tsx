"use client";

import { AlertCircle,GripVertical, ImageIcon, Plus, Trash2, X } from "lucide-react";
import { useCallback,useRef, useState } from "react";

import ImageLightbox from "@/components/ImageLightbox";

export interface PortfolioImage {
  id: string;
  url: string;
  caption?: string;
}

const MAX_IMAGES = 20;
const MAX_FILE_SIZE_MB = 5;

interface Props {
  images: PortfolioImage[];
  editable?: boolean;
  maxImages?: number;
  onAdd?: (files: File[]) => void;
  onRemove?: (id: string) => void;
  onReorder?: (images: PortfolioImage[]) => void;
  onCaptionChange?: (id: string, caption: string) => void;
}

export default function PortfolioGallery({
  images,
  editable = false,
  maxImages = MAX_IMAGES,
  onAdd,
  onRemove,
  onReorder,
  onCaptionChange,
}: Props) {
  const [lightbox, setLightbox] = useState<PortfolioImage | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const remaining = maxImages - images.length;

  const validateAndAdd = (files: File[]) => {
    setUploadError(null);
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setUploadError("Only image files are accepted.");
      return;
    }
    const oversized = imageFiles.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      setUploadError(`${oversized.length} file(s) exceed ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }
    const allowed = imageFiles.slice(0, remaining);
    if (allowed.length < imageFiles.length) {
      setUploadError(`Only ${remaining} more image(s) can be added (max ${maxImages}).`);
    }
    if (allowed.length > 0) onAdd?.(allowed);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) validateAndAdd(files);
    e.target.value = "";
  };

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!editable || remaining <= 0) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) validateAndAdd(files);
  };

  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setOverIndex(i);
  };
  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null);
        setOverIndex(null);
        return;
      }
      const reordered = [...images];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(dropIndex, 0, moved);
      onReorder?.(reordered);
      setDragIndex(null);
      setOverIndex(null);
    },
    [dragIndex, images, onReorder]
  );

  if (images.length === 0 && !editable) {
    return (
      <p className="text-sm text-gray-400 italic">No portfolio images yet.</p>
    );
  }

  return (
    <>
      {/* Image counter & upload error */}
      {editable && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <ImageIcon size={13} />
            <span>
              {images.length}/{maxImages} images
            </span>
          </div>
          {uploadError && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle size={13} />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      <div
        ref={dropZoneRef}
        onDragOver={(e) => {
          if (!editable) return;
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDropZone}
        className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${
          isDraggingOver ? "rounded-xl ring-2 ring-blue-400 ring-offset-2" : ""
        }`}
      >
        {images.map((img, i) => (
          <div
            key={img.id}
            draggable={editable}
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            className={`group relative rounded-xl overflow-hidden border bg-gray-50 aspect-square transition-opacity ${
              overIndex === i && dragIndex !== i ? "ring-2 ring-blue-500 opacity-70" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.caption ?? `Portfolio image ${i + 1}`}
              className="h-full w-full object-cover cursor-pointer"
              onClick={() => setLightbox(img)}
            />

            {/* Caption overlay */}
            {img.caption && !editable && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                <p className="text-xs text-white truncate">{img.caption}</p>
              </div>
            )}

            {/* Edit controls */}
            {editable && (
              <>
                <div className="absolute top-1.5 left-1.5 cursor-grab text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={16} />
                </div>
                <button
                  onClick={() => onRemove?.(img.id)}
                  className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <X size={12} />
                </button>
                {/* Caption edit */}
                {editingCaption === img.id ? (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1.5">
                    <input
                      autoFocus
                      defaultValue={img.caption ?? ""}
                      onBlur={(e) => {
                        onCaptionChange?.(img.id, e.target.value);
                        setEditingCaption(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingCaption(null);
                      }}
                      className="w-full rounded bg-white/20 px-2 py-0.5 text-xs text-white placeholder-white/50 outline-none"
                      placeholder="Add caption…"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingCaption(img.id)}
                    className="absolute bottom-0 left-0 right-0 bg-black/40 py-1 text-xs text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity text-center"
                  >
                    {img.caption ? img.caption : "Add caption"}
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* Add button */}
        {editable && remaining > 0 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            aria-label="Add photos"
          >
            <Plus size={24} />
            <span className="text-xs font-medium">Add photos</span>
            <span className="text-[10px] text-gray-300">{remaining} remaining</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {lightbox && (
        <ImageLightbox
          src={lightbox.url}
          alt={lightbox.caption ?? "Portfolio image"}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
