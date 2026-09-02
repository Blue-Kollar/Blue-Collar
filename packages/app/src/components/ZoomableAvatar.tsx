"use client";

import Image from "next/image";
import { useState } from "react";

import ImageLightbox from "./ImageLightbox";

interface Props {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export default function ZoomableAvatar({ src, alt, className, priority = false }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View full size photo of ${alt}`}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Image src={src} alt={alt} width={80} height={80} priority={priority} className={className} />
      </button>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
