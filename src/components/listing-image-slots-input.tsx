"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";

import {
  LISTING_IMAGE_MAX_FILES,
  normalizeListingImageUrls,
} from "@/lib/listing-images";

type ListingImageSlotsInputProps = {
  initialImageUrls?: string[];
  showReplaceNote?: boolean;
};

export function ListingImageSlotsInput({
  initialImageUrls = [],
  showReplaceNote = false,
}: ListingImageSlotsInputProps) {
  const normalizedInitialUrls = useMemo(
    () => normalizeListingImageUrls(initialImageUrls).slice(0, LISTING_IMAGE_MAX_FILES),
    [initialImageUrls],
  );
  const [previews, setPreviews] = useState<Array<string | null>>([
    normalizedInitialUrls[0] ?? null,
    normalizedInitialUrls[1] ?? null,
    normalizedInitialUrls[2] ?? null,
  ]);
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([null, null, null]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Bilder</p>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((slotIndex) => (
          <div key={slotIndex} className="space-y-1">
            <button
              type="button"
              onClick={() => fileInputRefs.current[slotIndex]?.click()}
              className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-zinc-300 bg-zinc-50 text-2xl font-semibold text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {previews[slotIndex] ? (
                <Image
                  src={previews[slotIndex] ?? ""}
                  alt={`Bilde ${slotIndex + 1}`}
                  width={256}
                  height={256}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-hidden>+</span>
              )}
            </button>
            <input
              ref={(el) => {
                fileInputRefs.current[slotIndex] = el;
              }}
              type="file"
              name={`image_slot_${slotIndex}`}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                if (file == null) return;
                const previewUrl = URL.createObjectURL(file);
                setPreviews((prev) => {
                  const next = [...prev];
                  next[slotIndex] = previewUrl;
                  return next;
                });
              }}
            />
            <input
              type="hidden"
              name={`existing_image_slot_${slotIndex}`}
              value={normalizedInitialUrls[slotIndex] ?? ""}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Du kan laste opp maks 3 bilder
      </p>
      {showReplaceNote ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Bytt et bilde ved å klikke på sloten.
        </p>
      ) : null}
    </div>
  );
}
