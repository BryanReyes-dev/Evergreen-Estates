"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AccountNavigation } from "@/components/AccountNavigation";

export default function Menu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const linkClass =
    "flex min-h-12 items-center rounded-lg px-4 py-3 text-base font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]";

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/15 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 p-3 md:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default border-0 bg-transparent"
          />
          <section
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-navigation-title"
            className="relative ml-auto flex h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-y-auto rounded-xl border border-white/10 bg-[#202324] p-4 shadow-2xl"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
              );
              if (focusable.length === 0) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <h2 id="mobile-navigation-title" className="text-lg font-semibold text-white">Navigation</h2>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-sm text-white/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
              >
                Close
              </button>
            </div>

            <nav aria-label="Mobile navigation" className="mt-4 flex flex-col gap-1">
              <Link href="/" className={linkClass} onClick={() => setOpen(false)}>Home</Link>
              <Link href="/search" className={linkClass} onClick={() => setOpen(false)}>Find homes</Link>
            </nav>

            <div className="mt-auto border-t border-white/10 pt-4">
              <AccountNavigation mobile onNavigate={() => setOpen(false)} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
