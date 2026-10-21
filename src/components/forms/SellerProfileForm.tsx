"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readApiData, ensureApiSuccess } from "@/lib/api/client";

type ContactMethod = "email" | "phone";

type SellerProfile = {
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  preferredContactMethod: ContactMethod;
  isPublished: boolean;
};

type ProfileValues = {
  displayName: string;
  bio: string;
  avatarUrl: string;
  contactEmail: string;
  contactPhone: string;
  preferredContactMethod: ContactMethod;
  isPublished: boolean;
};

const EMPTY_VALUES: ProfileValues = {
  displayName: "",
  bio: "",
  avatarUrl: "",
  contactEmail: "",
  contactPhone: "",
  preferredContactMethod: "email",
  isPublished: false,
};

function valuesFromProfile(profile: SellerProfile): ProfileValues {
  return {
    displayName: profile.displayName,
    bio: profile.bio ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    contactEmail: profile.contactEmail ?? "",
    contactPhone: profile.contactPhone ?? "",
    preferredContactMethod: profile.preferredContactMethod,
    isPublished: profile.isPublished,
  };
}

export function SellerProfileForm() {
  const router = useRouter();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [values, setValues] = useState<ProfileValues>(EMPTY_VALUES);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/v1/seller-profiles", {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/auth");
          return;
        }

        if (response.status === 404) {
          if (!cancelled) {
            setProfile(null);
            setValues(EMPTY_VALUES);
          }
          return;
        }

        const loaded = await readApiData<SellerProfile>(
          response,
          "Your seller profile could not be loaded. Refresh and try again.",
        );
        if (!cancelled) {
          setProfile(loaded);
          setValues(valuesFromProfile(loaded));
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Your seller profile could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function update<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const displayName = values.displayName.trim();
    const email = values.contactEmail.trim().toLowerCase();
    const phone = values.contactPhone.trim();
    const avatarUrl = values.avatarUrl.trim();

    if (!displayName || displayName.length > 100) {
      setError("Display name must be between 1 and 100 characters.");
      return;
    }
    if (values.bio.length > (profile ? 2000 : 1000)) {
      setError(profile ? "Your bio must be 2,000 characters or fewer." : "Your bio must be 1,000 characters or fewer.");
      return;
    }
    if (avatarUrl) {
      try {
        const url = new URL(avatarUrl);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
      } catch {
        setError("Enter a valid HTTP or HTTPS avatar URL, or leave it blank.");
        return;
      }
    }
    if (values.preferredContactMethod === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid contact email for your preferred contact method.");
      return;
    }
    if (values.preferredContactMethod === "phone" && (!/^[+()\d .-]{7,25}$/.test(phone) || (phone.match(/\d/g) ?? []).length < 7)) {
      setError("Enter a valid contact phone number for your preferred contact method.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid contact email address, or leave it blank.");
      return;
    }
    if (phone && (!/^[+()\d .-]{7,25}$/.test(phone) || (phone.match(/\d/g) ?? []).length < 7)) {
      setError("Enter a valid contact phone number, or leave it blank.");
      return;
    }

    const body = {
      displayName,
      bio: values.bio.trim() || null,
      avatarUrl: avatarUrl || null,
      contactEmail: email || null,
      contactPhone: phone || null,
      preferredContactMethod: values.preferredContactMethod,
      ...(profile ? { isPublished: values.isPublished } : {}),
    };

    setPending(true);
    try {
      const response = await fetch("/api/v1/seller-profiles", {
        method: profile ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const saved = await readApiData<SellerProfile>(
        response,
        "Your seller profile could not be saved. Check the form and try again.",
      );
      setProfile(saved);
      setValues(valuesFromProfile(saved));
      setNotice(profile ? "Profile changes saved." : "Seller profile created. You can now create listings.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your seller profile could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!profile || !window.confirm("Delete your seller profile? This cannot be undone.")) return;

    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await ensureApiSuccess(
        await fetch("/api/v1/seller-profiles", {
          method: "DELETE",
          credentials: "same-origin",
        }),
        "Your seller profile could not be deleted.",
      );
      setProfile(null);
      setValues(EMPTY_VALUES);
      setNotice("Seller profile deleted.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your seller profile could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="p-4 text-sm text-white/70" role="status">Loading your seller profile…</p>;
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-xl border border-white/10 bg-[#202324] p-4 text-white shadow-lg sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{profile ? "Your seller profile" : "Create a seller profile"}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
            A seller profile is required before you can publish listings. Your contact preference must have a matching contact detail.
          </p>
        </div>
        {profile && (
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
            {profile.isPublished ? "Public profile" : "Private profile"}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="profile-display-name" className="text-sm font-medium">Display name *</label>
            <Input id="profile-display-name" value={values.displayName} onChange={(event) => update("displayName", event.target.value)} maxLength={100} required disabled={pending} autoComplete="name" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="profile-bio" className="text-sm font-medium">About you</label>
            <textarea id="profile-bio" value={values.bio} onChange={(event) => update("bio", event.target.value)} rows={4} maxLength={profile ? 2000 : 1000} disabled={pending} className="w-full rounded-md border border-white/20 bg-[#141616] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]" />
            <p className="text-right text-xs text-white/50">{values.bio.length}/{profile ? 2000 : 1000}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="profile-avatar" className="text-sm font-medium">Avatar URL</label>
            <Input id="profile-avatar" type="url" inputMode="url" value={values.avatarUrl} onChange={(event) => update("avatarUrl", event.target.value)} maxLength={2048} disabled={pending} placeholder="https://example.com/avatar.jpg" />
          </div>
          <div className="space-y-2">
            <label htmlFor="profile-contact-method" className="text-sm font-medium">Preferred contact method *</label>
            <select id="profile-contact-method" value={values.preferredContactMethod} onChange={(event) => update("preferredContactMethod", event.target.value as ContactMethod)} disabled={pending} className="min-h-11 w-full rounded-md border border-white/20 bg-[#141616] px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]">
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="profile-contact-email" className="text-sm font-medium">Contact email {values.preferredContactMethod === "email" ? "*" : ""}</label>
            <Input id="profile-contact-email" type="email" autoComplete="email" value={values.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} maxLength={254} required={values.preferredContactMethod === "email"} disabled={pending} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="profile-contact-phone" className="text-sm font-medium">Contact phone {values.preferredContactMethod === "phone" ? "*" : ""}</label>
            <Input id="profile-contact-phone" type="tel" autoComplete="tel" value={values.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} maxLength={32} required={values.preferredContactMethod === "phone"} disabled={pending} />
          </div>
        </div>

        {profile && (
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 p-3 text-sm">
            <input type="checkbox" checked={values.isPublished} onChange={(event) => update("isPublished", event.target.checked)} disabled={pending} className="h-4 w-4 accent-[#78b75c]" />
            Make my seller profile publicly visible
          </label>
        )}

        {error && <p role="alert" className="rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="rounded-md border border-green-400/20 bg-green-950/20 p-3 text-sm text-green-200">{notice}</p>}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
            {pending ? "Saving…" : profile ? "Save profile" : "Create seller profile"}
          </Button>
          {profile && (
            <>
              {profile.isPublished && (
                <Link href={"/sellers/" + encodeURIComponent(profile.userId)} className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-4 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]">
                  View public profile
                </Link>
              )}
              <Link href="/listings/new" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-4 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]">
                Create listing
              </Link>
              <Button type="button" disabled={pending} onClick={handleDelete} className="min-h-11 w-full sm:w-auto">
                Delete profile
              </Button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
