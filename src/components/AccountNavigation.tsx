"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/** Account links can be reused in desktop navigation and the mobile menu. */
export function AccountNavigation({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const linkClass =
    "inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]";

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);

    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Sign out failed. Please try again.");
        return;
      }

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
    return (
      <span aria-label="Loading account" className="inline-flex min-h-11 items-center px-3 text-sm text-white/60">
        Loading account…
      </span>
    );
  }

  return (
    <div className={mobile ? "flex w-full flex-col gap-2" : "flex items-center gap-1"}>
      {session?.user ? (
        <>
          <span className="px-3 py-2 text-sm text-white/70">
            Signed in as {session.user.name || session.user.email}
          </span>
          <Link href="/profile" className={linkClass} onClick={onNavigate}>
            Seller profile
          </Link>
          <Link href="/listings/new" className={linkClass} onClick={onNavigate}>
            Create listing
          </Link>
          <Button type="button" disabled={signingOut} onClick={handleSignOut} className="min-h-11">
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </>
      ) : (
        <Link href="/auth" className={linkClass} onClick={onNavigate}>
          Sign in / Create account
        </Link>
      )}
      {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
    </div>
  );
}
