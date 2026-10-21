import Link from "next/link";

export default function SavedHomesPage() {
  return (
    <main className="mx-auto min-h-[60vh] w-full max-w-3xl px-4 py-10 text-white sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold">Saved homes</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
        Saving homes is not available yet. Favorites are not persisted in this version, so no saved list is shown here.
      </p>
      <Link
        href="/search"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-[#78b75c] px-4 text-sm font-semibold text-black hover:bg-[#8bc971] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Browse listings
      </Link>
    </main>
  );
}
