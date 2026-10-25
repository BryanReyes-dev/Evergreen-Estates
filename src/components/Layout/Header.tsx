import Image from "next/image";
import Link from "next/link";

import Menu from "./Menu";
import Nav from "./Nav";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 flex w-full items-center gap-3 border-b border-white/10 bg-[#141616]/95 px-3 py-2 backdrop-blur sm:px-5">
      <Link href="/" className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]">
        <Image
          src="/images/logo/evergreen_logo.png"
          alt="Evergreen Estates"
          width={44}
          height={44}
          priority
          className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
        />
        <span className="truncate text-lg font-semibold text-white sm:text-2xl">
          Evergreen Estates
        </span>
      </Link>

      <div className="ml-auto hidden md:block">
        <Nav />
      </div>
      <div className="ml-auto flex md:hidden">
        <Menu />
      </div>
    </header>
  );
}
