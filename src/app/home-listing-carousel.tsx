"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type HomeListingCarouselProps = {
  children: React.ReactNode;
  ariaLabel: string;
};

function arrowClass(side: "left" | "right") {
  const sideClass = side === "left" ? "left-2" : "right-2";
  return `${sideClass} absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white/90 p-2 text-zinc-700 shadow-md backdrop-blur transition hover:bg-white hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-50`;
}

export function HomeListingCarousel({
  children,
  ariaLabel,
}: HomeListingCarouselProps) {
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateButtons = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    updateButtons();
    const el = trackRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateButtons, { passive: true });
    const resizeObserver = new ResizeObserver(() => updateButtons());
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateButtons);
      resizeObserver.disconnect();
    };
  }, [updateButtons]);

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(240, el.clientWidth * 0.92);
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {canScrollPrev ? (
        <button
          type="button"
          aria-label="Forrige kort"
          className={arrowClass("left")}
          onClick={() => scrollByPage(-1)}
        >
          <span aria-hidden>‹</span>
        </button>
      ) : null}

      {canScrollNext ? (
        <button
          type="button"
          aria-label="Neste kort"
          className={arrowClass("right")}
          onClick={() => scrollByPage(1)}
        >
          <span aria-hidden>›</span>
        </button>
      ) : null}

      <ul
        ref={trackRef}
        aria-label={ariaLabel}
        className="mt-4 grid grid-flow-col auto-cols-[calc((100%-0.75rem)/2)] items-stretch gap-3 overflow-x-auto overflow-y-visible px-1 py-2 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:thin] sm:auto-cols-[calc((100%-1.5rem)/3)] sm:gap-3 lg:auto-cols-[calc((100%-2.25rem)/4)] lg:gap-3 [&::-webkit-scrollbar]:h-1.5"
      >
        {children}
      </ul>
    </div>
  );
}
