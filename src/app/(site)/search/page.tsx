import { Filters } from "@/components/Filters";
import { Suspense } from "react";
import { ResultsDisplay } from "@/components/ResultsDisplay";

interface SearchParams {
  query?: string;
  price?: string;
  tag?: string[];
}

export const dynamic = "force-dynamic";

const Search = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const params = await searchParams;

  return (
    <div>
      <Filters />
      <Suspense fallback={<div>Loading results...</div>}>
        <ResultsDisplay searchParams={params} />
      </Suspense>
    </div>
  );
};

export default Search;
