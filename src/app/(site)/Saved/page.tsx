import Link from "next/link";
import { headers } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import Listing from "@/components/Listing";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { getDrizzleDb } from "@/db/drizzle/client";
import { listings, users } from "@/db/schema";
import getMediaUrls from "@/db/supabase/util/GetMediaUrls";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
type SavedCard = { id: string; media: string[]; title: string; price: number; description: string };

export default async function SavedHomesPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return <main className="mx-auto min-h-[60vh] w-full max-w-3xl px-4 py-10 text-white sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold">Saved homes</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">Sign in to save properties and find them here later.</p>
      <Link href="/auth" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-[#78b75c] px-4 text-sm font-semibold text-black hover:bg-[#8bc971] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Sign in</Link>
    </main>;
  }

  let savedListingIds: string[];
  try {
    savedListingIds = await withAppUserTransaction(session.user.id, async (tx) => {
      const [user] = await tx.select({ savedListingIds: users.savedListings }).from(users)
        .where(eq(users.id, session.user.id)).limit(1);
      return user?.savedListingIds ?? [];
    });
  } catch (error) {
    console.error("Could not read saved homes for the signed-in user.", error);
    return <main className="mx-auto min-h-[60vh] w-full max-w-3xl px-4 py-10 text-white sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold">Saved homes unavailable</h1>
      <p className="mt-3 text-sm leading-6 text-white/65" role="alert">Your saved homes could not be loaded. Check that migration 0019 is applied, then try again.</p>
      <Link href="/search" className="mt-5 inline-flex min-h-11 items-center underline underline-offset-4">Browse listings</Link>
    </main>;
  }

  let savedListings: SavedCard[] = [];
  if (savedListingIds.length > 0) {
    try {
      const rows = await getDrizzleDb().select({
        id: listings.id, media: listings.media, title: listings.title, price: listings.price, description: listings.description,
      }).from(listings).where(inArray(listings.id, savedListingIds));
      const byId = new Map(rows.map((row) => [row.id, row]));
      savedListings = (await Promise.all(savedListingIds.map(async (id) => {
        const row = byId.get(id);
        if (!row) return null;
        return { id: row.id, media: await getMediaUrls(row.id, row.media), title: row.title, price: Number(row.price), description: row.description };
      }))).filter((row): row is SavedCard => row !== null);
    } catch (error) {
      console.error("Could not load saved listing cards.", error);
      return <main className="mx-auto min-h-[60vh] w-full max-w-3xl px-4 py-10 text-white sm:px-6 sm:py-14">
        <h1 className="text-2xl font-semibold">Saved homes unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-white/65" role="alert">We could not load the properties behind your saved list. Please try again later.</p>
      </main>;
    }
  }

  return <main className="mx-auto min-h-[60vh] w-full max-w-6xl px-4 py-8 text-white sm:px-6 sm:py-12">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Saved homes</h1>
        <p className="mt-2 text-sm text-white/65">{savedListings.length} {savedListings.length === 1 ? "home" : "homes"} saved</p>
      </div>
      <Link href="/search" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Browse more homes</Link>
    </header>
    {savedListings.length === 0 ? (
      <section className="mt-6 rounded-xl border border-dashed border-white/15 bg-[#202324] p-5 sm:p-8">
        <h2 className="text-lg font-semibold">No saved homes yet</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">Save a property using the heart button on a listing card or property detail page. Your saved homes will appear here.</p>
        <Link href="/search" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-[#78b75c] px-4 text-sm font-semibold text-black hover:bg-[#8bc971] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Find a home</Link>
      </section>
    ) : (
      <section aria-label="Your saved homes" className="mt-5 grid grid-cols-1 justify-items-center gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {savedListings.map((item) => <Listing key={item.id} listing={item} />)}
      </section>
    )}
  </main>;
}
