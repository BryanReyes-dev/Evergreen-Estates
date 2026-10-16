import { getListingById } from "@/db/queries/listings"

// get a specific listing via id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const listing = await getListingById(id);

    if (!listing) {
      return Response.json(
        {
          error: {
            code: "LISTING_NOT_FOUND",
            message: "Listing not found.",
          },
        },
        { status: 404 },
      );
    }

    return Response.json({ data: listing }, { status: 200 });
  } catch (error) {
    console.error(`GET /api/v1/listings/${id} failed:`, error);

    return Response.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve listing.",
        },
      },
      { status: 500 },
    );
  }
}