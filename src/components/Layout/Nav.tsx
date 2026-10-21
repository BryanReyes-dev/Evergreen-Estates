import Link from "next/link";

import { AccountNavigation } from "@/components/AccountNavigation";

const NAV_LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]";

export default function Nav() {
  return (
    <nav aria-label="Main navigation" className="flex flex-wrap items-center justify-end gap-1">
      <Link href="/" className={NAV_LINK_CLASS}>Home</Link>
      <Link href="/search" className={NAV_LINK_CLASS}>Find homes</Link>
      <AccountNavigation />
    </nav>
  );
}
