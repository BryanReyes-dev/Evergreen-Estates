import { getFilteredListings } from "@/db/queries/listings";
import type { filters as ListingFilters } from "@/app/types";


//get all listings with optional filters
export async function GET(request: Request) {

    const { searchParams } = new URL(request.url);

    let price: ListingFilters["price"] = null;

    const rawPrice = searchParams.get("price");

    if (rawPrice !== null) {
    const parts = rawPrice.split("-");

    if (parts.length !== 2 || parts.some((part) => part.trim() === "")) {
        return Response.json(
        {
            error: {
            code: "INVALID_PRICE_RANGE",
            message: "Use price=min-max.",
            },
        },
        { status: 400 },
        );
    }

    const [minPrice, maxPrice] = parts.map(Number);

    if (
        !Number.isFinite(minPrice) ||
        !Number.isFinite(maxPrice) ||
        minPrice < 0 ||
        maxPrice < minPrice
    ) {
        return Response.json(
        {
            error: {
            code: "INVALID_PRICE_RANGE",
            message: "Provide a valid minimum and maximum price.",
            },
        },
        { status: 400 },
        );
    }

    price = [minPrice, maxPrice];
    }

    
    const search = searchParams.get("query")?.trim() || null;

    const tags = searchParams
        .getAll("tag")
        .map((tag) => tag.trim())
        .filter(Boolean);

  try {
    const listings = await getFilteredListings({
      price: price,
      tags: tags.length > 0 ? tags : null,
      search: search,
    });

    return Response.json({ data: listings }, { status: 200 });
  } catch (error) {
    console.error("GET /api/v1/listings failed:", error);

    return Response.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve listings.",
        },
      },
      { status: 500 },
    );
  }
}