import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ListingForm } from "@/components/forms/ListingForm";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import { getAuth } from "@/lib/auth";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/auth");

  // Read the edit payload only after checking that the signed-in user owns it.
  const listing = await withAppUserTransaction(session.user.id, async (tx) => {
    const [row] = await tx
      .select({
        id: listings.id,
        title: listings.title,
        price: listings.price,
        beds: listings.beds,
        baths: listings.baths,
        sqft: listings.sqft,
        address: listings.address,
        description: listings.description,
        tags: listings.tags,
      })
      .from(listings)
      .where(
        and(
          eq(listings.id, listingId),
          eq(listings.sellerUserId, session.user.id),
        ),
      )
      .limit(1);
    return row ?? null;
  }).catch((error: unknown) => {
    console.error("Could not load listing for editing.", error);
    return null;
  });

  // Do not reveal whether another user's listing exists through the edit route.
  if (!listing) notFound();

  return (
    <main className="min-h-[70vh] px-4 py-6 sm:px-6 sm:py-10">
      <ListingForm
        initial={{
          ...listing,
          price: Number(listing.price),
        }}
      />
    </main>
  );
}
