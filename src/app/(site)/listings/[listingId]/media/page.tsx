import { ListingMediaManager } from "@/components/ListingMediaManager";

export default async function ListingMediaPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;

  return <ListingMediaManager listingId={listingId} />;
}
