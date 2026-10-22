"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { readApiData } from "@/lib/api/client";
import {
  MAX_LISTING_PRICE,
  MIN_LISTING_PRICE,
  SUPPORTED_LISTING_TAGS,
  SUPPORTED_LISTING_TAG_VALUES,
} from "@/lib/listing-constants";

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
};

const EMPTY_VALUES: ListingValues = {
  title: "",
  price: "",
  beds: "0",
  baths: "0",
  sqft: "",
  address: "",
  description: "",
};

const fieldClassName =
  "w-full rounded-lg border-[3px] border-[#228000] bg-[#141616] text-white placeholder:text-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);

/** Shared, strictly validated form for creating and editing a listing. */
export function ListingForm({ initial }: { initial?: ListingFormInitial }) {
  const router = useRouter();
  const [values, setValues] = useState<ListingValues>(() =>
    initial ? { ...EMPTY_VALUES, beds: "", baths: "" } : EMPTY_VALUES,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    initial
      ? initial.tags.map((tag) => tag.trim().toLowerCase()).filter((tag) =>
          SUPPORTED_LISTING_TAG_VALUES.includes(tag),
        )
      : [],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ListingValues>(key: K, value: ListingValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleTag(tag: string, checked: boolean) {
    const normalized = tag.toLowerCase();
    setSelectedTags((current) =>
      checked
        ? current.includes(normalized) ? current : [...current, normalized]
        : current.filter((item) => item !== normalized),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // On edit, blank inputs use their current values (shown as placeholders).
    const title = (values.title.trim() || initial?.title || "").trim();
    const address = (values.address.trim() || initial?.address || "").trim();
    const description = (values.description.trim() || initial?.description || "").trim();
    const price = Number(values.price || (initial ? String(initial.price) : ""));
    const beds = Number(values.beds || (initial ? String(initial.beds) : "0"));
    const baths = Number(values.baths || (initial ? String(initial.baths) : "0"));
    const sqft = Number(values.sqft || (initial ? String(initial.sqft) : ""));
    const tags = selectedTags;

    if (title.length < 3 || title.length > 140) {
      setError("Title must be between 3 and 140 characters.");
      return;
    }
    if (!Number.isFinite(price) || price < MIN_LISTING_PRICE || price > MAX_LISTING_PRICE) {
      setError("Price must be between $10,000 and $10,000,000.");
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
          ? "Enter a new value to change a field. Fields left blank keep their current values."
          : "Add your property details first. You can upload photos and videos after creating the listing."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="listing-title" className="text-sm font-medium">Listing title *</label>
            <Input id="listing-title" className={fieldClassName} value={values.title} placeholder={initial?.title ?? "Enter a listing title"} onChange={(event) => update("title", event.target.value)} required maxLength={140} disabled={pending} />
          </div>
          <div className="space-y-2">
            <label htmlFor="listing-price" className="text-sm font-medium">Price (USD) *</label>
            <Input id="listing-price" className={fieldClassName} type="number" inputMode="numeric" min={MIN_LISTING_PRICE} max={MAX_LISTING_PRICE} step="1" value={values.price} placeholder={initial ? String(initial.price) : "10000–10000000"} onChange={(event) => update("price", event.target.value)} required disabled={pending} />
            <p className="text-xs text-white/50">Supported range: {formatPrice(MIN_LISTING_PRICE)}–{formatPrice(MAX_LISTING_PRICE)}.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="listing-sqft" className="text-sm font-medium">Square feet *</label>
            <Input id="listing-sqft" className={fieldClassName} type="number" inputMode="numeric" min="1" max="1000000" step="1" value={values.sqft} placeholder={initial ? String(initial.sqft) : "e.g. 1800"} onChange={(event) => update("sqft", event.target.value)} required disabled={pending} />
          </div>
          <div className="space-y-2">
            <label htmlFor="listing-beds" className="text-sm font-medium">Bedrooms *</label>
            <Input id="listing-beds" className={fieldClassName} type="number" inputMode="numeric" min="0" max="100" step="1" value={values.beds} placeholder={initial ? String(initial.beds) : "0"} onChange={(event) => update("beds", event.target.value)} required disabled={pending} />
          </div>
          <div className="space-y-2">
            <label htmlFor="listing-baths" className="text-sm font-medium">Bathrooms *</label>
            <Input id="listing-baths" className={fieldClassName} type="number" inputMode="numeric" min="0" max="100" step="1" value={values.baths} placeholder={initial ? String(initial.baths) : "0"} onChange={(event) => update("baths", event.target.value)} required disabled={pending} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="listing-address" className="text-sm font-medium">Address *</label>
            <Input id="listing-address" className={fieldClassName} value={values.address} placeholder={initial?.address ?? "Enter the property address"} onChange={(event) => update("address", event.target.value)} required maxLength={300} autoComplete="street-address" disabled={pending} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="listing-description" className="text-sm font-medium">Description *</label>
            <textarea id="listing-description" value={values.description} placeholder={initial?.description ?? "Describe the property"} onChange={(event) => update("description", event.target.value)} rows={6} required maxLength={5000} disabled={pending} className={fieldClassName + " px-3 py-2 text-sm"} />
            <p className="text-right text-xs text-white/50">{values.description.length}/5000</p>
          </div>
          <fieldset className="space-y-3 sm:col-span-2">
            <legend className="text-sm font-medium">Property tags</legend>
            <p className="text-xs text-white/50">Choose from the supported tags. Fields not selected will not be added.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SUPPORTED_LISTING_TAGS.map((tag) => {
                const tagValue = tag.toLowerCase();
                const tagId = "listing-tag-" + tagValue.replace(/[^a-z0-9]+/g, "-");
                return (
                  <div key={tagValue} className="flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-[#141616] px-3 py-2 text-sm text-white">
                    <Checkbox
                      id={tagId}
                      checked={selectedTags.includes(tagValue)}
                      disabled={pending}
                      onCheckedChange={(checked) => toggleTag(tag, checked === true)}
                    />
                    <label htmlFor={tagId}>{tag}</label>
                  </div>
                );
              })}
            </div>
          </fieldset>
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
