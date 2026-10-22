"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type AccountSummary = { userId: string; name: string; imageUrl: string | null };

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Account links are compact on desktop and become a full list inside the phone menu. */
export function AccountNavigation({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const userId = session?.user?.id;

  const refreshSummary = useCallback(async () => {
    if (!userId) {
      setSummary(null);
      return;
    }
    try {
      const response = await fetch("/api/v1/users/me/profile", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !("data" in payload)) return;
      const data = (payload as { data?: { name?: unknown; imageUrl?: unknown } }).data;
      if (typeof data?.name === "string") {
        setSummary({
          userId,
          name: data.name,
          imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : null,
        });
      }
    } catch {
      // The session name and externally hosted avatar remain safe fallbacks.
    }
  }, [userId]);

  useEffect(() => {
    void refreshSummary();
    const refresh = () => { void refreshSummary(); };
    window.addEventListener("evergreen:account-updated", refresh);
    return () => window.removeEventListener("evergreen:account-updated", refresh);
  }, [refreshSummary, pathname, session?.user?.image]);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Sign out failed. Please try again.");
        return;
      }
      setSummary(null);
      onNavigate?.();
      router.replace("/");
      router.refresh();
    } catch {
      setError("Sign out failed. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  if (isPending) {
    return <span aria-label="Loading account" className="inline-flex min-h-11 items-center px-3 text-sm text-white/60">Loading account…</span>;
  }

  const accountMatchesSession = Boolean(userId && summary?.userId === userId);
  const userName = (accountMatchesSession ? summary?.name : null) || session?.user?.name || session?.user?.email || "Account";
  const imageUrl = accountMatchesSession
    ? summary?.imageUrl ?? null
    : isHttpUrl(session?.user?.image) ? session.user.image : null;
  const linkClass =
    "flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]";

  if (!session?.user) {
    return <Link href="/auth" className={linkClass} onClick={onNavigate}>Sign in / Create account</Link>;
  }

  if (mobile) {
    return (
      <div className="flex w-full flex-col gap-1">
        <div className="flex min-w-0 items-center gap-3 rounded-lg bg-black/20 p-3">
          <UserAvatar name={userName} imageUrl={imageUrl} identity={userId} className="h-10 w-10 text-sm" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-white/45">Signed in as</p>
            <p className="truncate text-sm font-medium text-white">{userName}</p>
          </div>
        </div>
        <Link href="/account" className={linkClass} onClick={onNavigate}>Account settings</Link>
        <Link href="/profile" className={linkClass} onClick={onNavigate}>Seller profile</Link>
        <Link href="/Saved" className={linkClass} onClick={onNavigate}>Saved homes</Link>
        <Link href="/listings/new" className={linkClass} onClick={onNavigate}>Create listing</Link>
        <Button type="button" disabled={signingOut} onClick={handleSignOut} className="mt-1 min-h-11 w-full">
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
        {error && <p className="px-2 text-sm text-red-300" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <details
      className="group relative"
      onClick={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest("a, button")) {
          event.currentTarget.open = false;
        }
      }}
    >
      <summary className="inline-flex min-h-11 max-w-48 cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 text-sm text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c] [&::-webkit-details-marker]:hidden">
        <UserAvatar name={userName} imageUrl={imageUrl} identity={userId} className="h-8 w-8 text-xs" />
        <span className="max-w-24 truncate">{userName}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-white/60">
          <path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#202324] p-2 shadow-2xl">
        <p className="truncate px-3 py-2 text-xs text-white/50">{session.user.email}</p>
        <Link href="/account" className={linkClass}>Account settings</Link>
        <Link href="/profile" className={linkClass}>Seller profile</Link>
        <Link href="/Saved" className={linkClass}>Saved homes</Link>
        <Link href="/listings/new" className={linkClass}>Create listing</Link>
        <div className="my-1 border-t border-white/10" />
        <Button type="button" disabled={signingOut} onClick={handleSignOut} className="min-h-11 w-full">
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
        {error && <p className="px-2 py-1 text-xs text-red-300" role="alert">{error}</p>}
      </div>
    </details>
  );
}
