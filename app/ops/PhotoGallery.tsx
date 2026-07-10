"use client";

import { useEffect, useRef, useState } from "react";

interface Photo {
  url: string;
  alt: string;
}

const COLS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export default function PhotoGallery({
  photos,
  columns = 3,
}: {
  photos: Photo[];
  columns?: 2 | 3 | 4;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activeIndex !== null && !dialog.open) dialog.showModal();
    if (activeIndex === null && dialog.open) dialog.close();
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setActiveIndex((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setActiveIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, photos.length]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className={`grid ${COLS[columns]} gap-3`}>
        {photos.map((photo, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIndex(i)}
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setActiveIndex(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="bg-transparent p-0 max-w-none max-h-none w-screen h-screen backdrop:bg-black/90"
      >
        {activeIndex !== null && (
          <div className="w-screen h-screen flex flex-col items-center justify-center gap-4 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[activeIndex].url}
              alt={photos[activeIndex].alt}
              className="max-w-full max-h-[80vh] object-contain rounded"
            />
            <div className="flex items-center gap-6 text-white text-sm">
              <button
                type="button"
                onClick={() => setActiveIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length))}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                ← Prev
              </button>
              <span>{activeIndex + 1} / {photos.length}</span>
              <button
                type="button"
                onClick={() => setActiveIndex((i) => (i === null ? i : (i + 1) % photos.length))}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
