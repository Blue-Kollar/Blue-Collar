"use client";

import { RotateCcw,X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback,useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.75;

export default function ImageLightbox({ src, alt, onClose }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetAtDragStart = useRef({ x: 0, y: 0 });

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const reset = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, []);

  const zoom = useCallback((delta: number) => {
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta));
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale === 1) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetAtDragStart.current = offset;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: offsetAtDragStart.current.x + (e.clientX - dragStart.current.x),
      y: offsetAtDragStart.current.y + (e.clientY - dragStart.current.y),
    });
  };
  const onMouseUp = () => { dragging.current = false; };

  // Touch pinch-zoom + drag
  const lastTouchDist = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchDist.current = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
    } else if (e.touches.length === 1 && scale > 1) {
      dragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      offsetAtDragStart.current = offset;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      const delta = (dist - lastTouchDist.current) / 80;
      zoom(delta);
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && dragging.current) {
      setOffset({
        x: offsetAtDragStart.current.x + (e.touches[0].clientX - dragStart.current.x),
        y: offsetAtDragStart.current.y + (e.touches[0].clientY - dragStart.current.y),
      });
    }
  };
  const onTouchEnd = () => {
    dragging.current = false;
    lastTouchDist.current = null;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Full size image: ${alt}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in"
      onClick={onClose}
    >
      {/* Controls */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => zoom(ZOOM_STEP)}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 transition-colors"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => zoom(-ZOOM_STEP)}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 transition-colors"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={reset}
          aria-label="Reset zoom"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={onClose}
          aria-label="Close image viewer"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Loading spinner */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Image */}
      <div
        className="relative max-h-screen max-w-screen overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ cursor: scale > 1 ? "grab" : "default" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain select-none transition-opacity duration-300"
          style={{
            opacity: loaded ? 1 : 0,
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transition: dragging.current ? "none" : "transform 0.15s ease",
          }}
          draggable={false}
        />
      </div>

      {/* Hint */}
      {loaded && scale === 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50 select-none">
          Scroll or pinch to zoom · ESC to close
        </p>
      )}
    </div>
  );
}
