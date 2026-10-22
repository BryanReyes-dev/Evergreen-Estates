import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";

import { SellerProfileForm } from "@/components/forms/SellerProfileForm";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import { getAuth } from "@/lib/auth";

type OwnedListing = {
  id: string;
  title: string;
  price: string;
  address: string;
  updatedAt: string;
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/auth");

  let ownedListings: OwnedListing[] = [];
  let listingsUnavailable = false;

  // Scope the query to the verified session identity. RLS remains the backend
  // boundary; the page never accepts an owner ID from URL or client input.
  try {
    ownedListings = await withAppUserTransaction(session.user.id, async (tx) =>
      tx
        .select({
          id: listings.id,
          title: listings.title,
          price: listings.price,
          address: listings.address,
          updatedAt: listings.updatedAt,
        })
        .from(listings)
        .where(eq(listings.sellerUserId, session.user.id))
        .orderBy(desc(listings.updatedAt)),
    );
  } catch (error) {
    console.error("Could not load the seller's listings.", error);
    listingsUnavailable = true;
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      <SellerProfileForm />

      <section className="rounded-xl border border-white/10 bg-[#202324] p-4 text-white sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Your listings</h2>
            <p className="mt-1 text-sm text-white/60">
              Manage the properties associated with your seller account.
            </p>
          </div>
          <Link
            href="/listings/new"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#78b75c] px-4 text-sm font-semibold text-black hover:bg-[#8bc971] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Create listing
          </Link>
        </div>

        {listingsUnavailable ? (
          <p role="alert" className="mt-5 text-sm text-red-200">
            Your listings could not be loaded. Refresh the page or try again later.
          </p>
        ) : ownedListings.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/60">
            You have not created any listings yet. Use Create listing to add your first property; your seller profile must be complete first.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-white/10">
            {ownedListings.map((listing) => (
              <li key={listing.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-medium text-white">{listing.title}</h3>
                  <p className="mt-1 text-sm text-white/60">{listing.address}</p>
                  <p className="mt-1 text-sm font-semibold text-[#a6d78f]">
                    {"$" + Number(listing.price).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={"/listings/" + encodeURIComponent(listing.id)} className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-3 text-sm text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]">
                    View
                  </Link>
                  <Link href={"/listings/" + encodeURIComponent(listing.id) + "/edit"} className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-3 text-sm text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]">
                    Edit
                  </Link>
                  <Link href={"/listings/" + encodeURIComponent(listing.id) + "/media"} className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-3 text-sm text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]">
                    Manage media
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
