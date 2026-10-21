"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readApiData } from "@/lib/api/client";

export type ListingFormInitial = {
  id: string;
  title: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  description: string;
  tags: string[];
};

type ListingValues = {
  title: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  address: string;
  description: string;
  tags: string;
};

function valuesFromListing(listing: ListingFormInitial): ListingValues {
  return {
    title: listing.title,
    price: String(listing.price),
    beds: String(listing.beds),
    baths: String(listing.baths),
    sqft: String(listing.sqft),
    address: listing.address,
    description: listing.description,
    tags: listing.tags.join(", "),
  };
}

const EMPTY_VALUES: ListingValues = {
  title: "",
  price: "",
  beds: "0",
  baths: "0",
  sqft: "",
  address: "",
  description: "",
  tags: "",
};

/** Shared, strictly validated form for creating and editing a listing. */
export function ListingForm({ initial }: { initial?: ListingFormInitial }) {
  const router = useRouter();
  const [values, setValues] = useState<ListingValues>(
    initial ? valuesFromListing(initial) : EMPTY_VALUES,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ListingValues>(key: K, value: ListingValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const title = values.title.trim();
    const address = values.address.trim();
    const description = values.description.trim();
    const price = Number(values.price);
    const beds = Number(values.beds);
    const baths = Number(values.baths);
    const sqft = Number(values.sqft);
    const tags = values.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (title.length < 3 || title.length > 140) {
      setError("Title must be between 3 and 140 characters.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000_000) {
      setError("Enter a valid positive price.");
      return;
    }
    if (!Number.isSafeInteger(beds) || beds < 0 || beds > 100) {
      setError("Bedrooms must be a whole number between 0 and 100.");
      return;
    }
    if (!Number.isSafeInteger(baths) || baths < 0 || baths > 100) {
      setError("Bathrooms must be a whole number between 0 and 100.");
      return;
    }
    if (!Number.isSafeInteger(sqft) || sqft < 1 || sqft > 1_000_000) {
      setError("Square footage must be between 1 and 1,000,000.");
      return;
    }
    if (address.length < 5 || address.length > 300) {
      setError("Address must be between 5 and 300 characters.");
      return;
    }
    if (!description || description.length > 5000) {
      setError("Description must contain 1–5,000 characters.");
      return;
    }
    if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
      setError("Enter at most 20 comma-separated tags, each 40 characters or fewer.");
      return;
    }

    const body = { title, price, beds, baths, sqft, address, description, tags };
    const endpoint = initial
      ? "/api/v1/listings/" + encodeURIComponent(initial.id)
      : "/api/v1/listings";

    setPending(true);
    try {
      const saved = await readApiData<{ id: string }>(
        await fetch(endpoint, {
          method: initial ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        "Your listing could not be saved. Check the details and try again.",
      );

      router.push("/listings/" + encodeURIComponent(saved.id));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your listing could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-xl border border-white/10 bg-[#202324] p-4 text-white shadow-lg sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold">{initial ? "Edit listing" : "Create a listing"}</h1>
      <p className="mt-2 text-sm leading-6 text-white/70">
        {initial
          ? "Update the details shown to people browsing your property."
          : "Add your property details first. You can upload photos and videos after creating the listing."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="listing-title" className="text-sm font-medium">Listing title *</label>
            <Input id="listing-title" value={values.title} onChange={(event) => update("title", event.target.value)} required maxLength={140} disabled={pending} />
          </div>
          <div className="space-y-2">
            <label htmlFor="listing-price" className="text-sm font-medium">Price (USD) *</label>
            <Input id="listing-price" type="number" inputMode="decimal" min="0.01" step="0.01" value={values.price} onChange={(event) => update("price", event.target.value)} required disabled={pending} />
          </div>
          <div className="space-y-2">
            <label htmlFor="listing-sqft" className="text-sm font-medium">Square feet *</label>
            <Input id="listing-sqft" type="number" inputMode="numeric" min="1" max="1000000" step="1" value={values.sqft} onChange={(event) => update("sqft", event.target.value)} required disabled={pending} />
          </div>
          <div className="space-y-2">
            <label htmlFor="listing-beds" className="text-sm font-medium">Bedrooms *</label>
            <Input id="listing-beds" type="number" inputMode="numeric" min="0" max="100" step="1" value={values.beds} onChange={(event) => update("beds", event.target.value)} required disabled={pending} />
          </div>
          <div className="space-y-2">
            <label htmlFor="listing-baths" className="text-sm font-medium">Bathrooms *</label>
            <Input id="listing-baths" type="number" inputMode="numeric" min="0" max="100" step="1" value={values.baths} onChange={(event) => update("baths", event.target.value)} required disabled={pending} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="listing-address" className="text-sm font-medium">Address *</label>
            <Input id="listing-address" value={values.address} onChange={(event) => update("address", event.target.value)} required maxLength={300} autoComplete="street-address" disabled={pending} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="listing-description" className="text-sm font-medium">Description *</label>
            <textarea id="listing-description" value={values.description} onChange={(event) => update("description", event.target.value)} rows={6} required maxLength={5000} disabled={pending} className="w-full rounded-md border border-white/20 bg-[#141616] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]" />
            <p className="text-right text-xs text-white/50">{values.description.length}/5000</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="listing-tags" className="text-sm font-medium">Tags</label>
            <Input id="listing-tags" value={values.tags} onChange={(event) => update("tags", event.target.value)} disabled={pending} placeholder="modern, garden, waterfront" />
            <p className="text-xs text-white/50">Separate tags with commas. Use up to 20 tags, each no longer than 40 characters.</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
            {pending ? "Saving…" : initial ? "Save changes" : "Create listing"}
          </Button>
          {initial && (
            <Button type="button" disabled={pending} onClick={() => router.push("/listings/" + encodeURIComponent(initial.id))} className="min-h-11 w-full sm:w-auto">
              Cancel
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
