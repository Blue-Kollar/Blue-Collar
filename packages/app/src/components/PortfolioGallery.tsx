"use client";

import { useState, useRef, useCallback } from "react";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";

export interface PortfolioImage {
  id: string;
  url: string;
  caption?: string;
}

interface Props {
  images: PortfolioImage[];
  editable?: boolean;
  onAdd?: (files: File[]) => void;
  onRemove?: (id: string) => void;
  onReorder?: (images: PortfolioImage[]) => void;
  onCaptionChange?: (id: string, caption: string) => void;
}

export default function PortfolioGallery({
  images,
  editable = false,
  onAdd,
  onRemove,
  onReorder,
  onCaptionChange,
}: Props) {
  const [lightbox, setLightbox] = useState<PortfolioImage | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length && onAdd) onAdd(files);
    e.target.value = "";
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        {editable && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            aria-label="Add photos"
          >
            <Plus size={24} />
            <span className="text-xs font-medium">Add photos</span>
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
