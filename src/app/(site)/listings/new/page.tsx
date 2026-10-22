import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ListingForm } from "@/components/forms/ListingForm";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { sellerProfiles } from "@/db/schema";
import { getAuth } from "@/lib/auth";

export default async function NewListingPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/auth");

  // The API still validates eligibility. Redirecting here guides the seller
  // through profile setup before displaying a form that cannot yet be saved.
  let profilePublished: boolean | null = null;
  try {
    const profile = await withAppUserTransaction(session.user.id, async (tx) => {
      const [row] = await tx
        .select({ userId: sellerProfiles.userId, isPublished: sellerProfiles.isPublished })
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, session.user.id))
        .limit(1);
      return row ?? null;
    });
    profilePublished = profile?.isPublished ?? null;
  } catch (error) {
    console.error("Could not verify seller eligibility for listing creation.", error);
    return (
      <main className="mx-auto min-h-[60vh] w-full max-w-2xl px-4 py-10 text-white sm:px-6">
        <h1 className="text-2xl font-semibold">Listing creation is temporarily unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          We could not verify your seller profile. Nothing was created. Try again shortly.
        </p>
        <Link
          href="/profile"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-4 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
        >
          Return to seller profile
        </Link>
      </main>
    );
  }

  if (profilePublished === null) redirect("/profile");

  if (!profilePublished) {
    return (
      <main className="mx-auto min-h-[60vh] w-full max-w-2xl px-4 py-10 text-white sm:px-6">
        <h1 className="text-2xl font-semibold">Publish your seller profile first</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          Listings are displayed alongside a public seller profile. Publish your profile to create a listing.
        </p>
        <Link
          href="/profile"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-4 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
        >
          Publish seller profile
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] px-4 py-6 sm:px-6 sm:py-10">
      <ListingForm />
    </main>
  );
}
