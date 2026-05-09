"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

type ListingImageGalleryProps = {
  imageUrls: string[];
  title: string;
};

const arrowBtnClass =
  "pointer-events-auto absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white/80 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-black/45 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:bg-black/55 sm:size-12";

export function ListingImageGallery({
  imageUrls,
  title,
}: ListingImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const count = imageUrls.length;
  const safeIndex = ((activeIndex % count) + count) % count;
  const activeSrc = imageUrls[safeIndex] ?? "";

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i + 1) % count);
  }, [count]);

  if (count === 0) {
    return null;
  }

  const showArrows = count > 1;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
        <div className="flex items-center justify-center px-2 py-6 sm:px-5 sm:py-10">
          <Image
            src={activeSrc}
            alt={`Bilde ${safeIndex + 1} av ${count}: ${title}`}
            width={1280}
            height={960}
            unoptimized
            className="mx-auto h-auto max-h-[min(62vh,640px)] w-full max-w-full object-contain transition-opacity duration-300 ease-out"
          />
        </div>
        {showArrows ? (
          <>
            <button
              type="button"
              aria-label="Forrige bilde"
              className={`${arrowBtnClass} left-2.5 sm:left-3`}
              onClick={goPrev}
            >
              <span className="sr-only">Forrige</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 18l-6-6 6-6"
                />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Neste bilde"
              className={`${arrowBtnClass} right-2.5 sm:right-3`}
              onClick={goNext}
            >
              <span className="sr-only">Neste</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 18l6-6-6-6"
                />
              </svg>
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <ul className="flex flex-wrap gap-2 sm:gap-3">
          {imageUrls.map((url, index) => {
            const isActive = index === safeIndex;
            return (
              <li
                key={`${url}-${index}`}
                className="w-[calc(50%-0.25rem)] shrink-0 sm:w-28"
              >
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`block w-full rounded-lg border bg-white text-left transition ${
                    isActive
                      ? "border-blue-500 ring-2 ring-blue-400/40"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                  aria-label={`Vis bilde ${index + 1}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <Image
                    src={url}
                    alt={`Miniatyr ${index + 1}`}
                    width={160}
                    height={120}
                    unoptimized
                    className="h-24 w-full rounded-[calc(0.5rem-1px)] object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
