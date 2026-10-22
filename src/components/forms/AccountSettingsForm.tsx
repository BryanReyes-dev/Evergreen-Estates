"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { authClient } from "@/lib/auth-client";
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  type AccountPreferences,
  type DefaultListingSort,
  type ListingViewMode,
} from "@/lib/account-preferences";

type AccountData = {
  name: string;
  image: string | null;
  imageUrl: string | null;
  preferences: AccountPreferences;
};

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/15 bg-[#141616] px-3 text-sm text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]";

async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null &&
      "error" in payload && typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : fallback;
    throw new Error(message);
  }
  if (typeof payload !== "object" || payload === null || !("data" in payload)) {
    throw new Error(fallback);
  }
  return (payload as { data: T }).data;
}

export function AccountSettingsForm() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const fileInput = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [name, setName] = useState("");
  const [preferences, setPreferences] = useState<AccountPreferences>(DEFAULT_ACCOUNT_PREFERENCES);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAccount() {
      try {
        const response = await fetch("/api/v1/users/me/profile", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const loaded = await readResponse<AccountData>(
          response,
          "Your account settings could not be loaded. Refresh the page and try again.",
        );
        if (!cancelled) {
          setAccount(loaded);
          setName(loaded.name);
          setPreferences(loaded.preferences);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Your account settings could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAccount();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedPreview(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setSelectedPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function changePreference<K extends keyof AccountPreferences>(
    key: K,
    value: AccountPreferences[K],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setNotice(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(file.type)) {
      setError("Choose a JPEG, PNG, WebP, AVIF, or GIF image.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Avatar images must be 5 MB or smaller.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }

  async function uploadAvatar() {
    if (!selectedFile) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", selectedFile);
      const saved = await readResponse<{ image: string; imageUrl: string | null }>(
        await fetch("/api/v1/users/me/avatar", {
          method: "POST",
          credentials: "same-origin",
          body,
        }),
        "Your avatar could not be uploaded. Try again.",
      );
      setAccount((current) => current ? { ...current, image: saved.image, imageUrl: saved.imageUrl } : current);
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = "";

      const sessionUpdate = await authClient.updateUser({ image: saved.image });
      setNotice(sessionUpdate.error
        ? "Your avatar was saved. Refresh the page if your navigation still shows the previous image."
        : "Your avatar has been updated.");
      window.dispatchEvent(new Event("evergreen:account-updated"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your avatar could not be uploaded.");
    } finally {
      setPending(false);
    }
  }

  async function removeAvatar() {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await readResponse<{ image: null; imageUrl: null }>(
        await fetch("/api/v1/users/me/avatar", {
          method: "DELETE",
          credentials: "same-origin",
        }),
        "Your avatar could not be removed. Try again.",
      );
      setAccount((current) => current ? { ...current, image: null, imageUrl: null } : current);
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = "";
      const sessionUpdate = await authClient.updateUser({ image: null });
      setNotice(sessionUpdate.error
        ? "Your photo was removed. Refresh the page if your navigation still shows the previous image."
        : "Your photo was removed. Your initials avatar is back.");
      window.dispatchEvent(new Event("evergreen:account-updated"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your avatar could not be removed.");
    } finally {
      setPending(false);
    }
  }

  async function saveProfileAndPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const nextName = name.trim();
    if (nextName.length < 1 || nextName.length > 100) {
      setError("Your name must be between 1 and 100 characters.");
      return;
    }

    setPending(true);
    try {
      if (nextName !== account?.name) {
        const updatedUser = await authClient.updateUser({ name: nextName });
        if (updatedUser.error) {
          throw new Error("Your name could not be updated. Try again.");
        }
      }

      const saved = await readResponse<AccountData>(
        await fetch("/api/v1/users/me/profile", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences }),
        }),
        "Your browsing preferences could not be saved.",
      );
      setAccount({ ...saved, name: nextName });
      setName(nextName);
      setPreferences(saved.preferences);
      setNotice("Profile and browsing preferences saved.");
      window.dispatchEvent(new Event("evergreen:account-updated"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your account settings could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);
    if (currentPassword.length === 0) {
      setPasswordError("Enter your current password.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setPasswordError("Your new password must be between 8 and 128 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setPasswordPending(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setPasswordError(result.error.message || "Your password could not be changed. Check your current password and try again.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice("Password changed. Other active sessions have been signed out.");
    } catch {
      setPasswordError("Your password could not be changed. Check your current password and try again.");
    } finally {
      setPasswordPending(false);
    }
  }

  if (loading) return <p className="p-4 text-sm text-white/70" role="status">Loading account settings…</p>;

  if (!account) {
    return (
      <section className="rounded-xl border border-white/10 bg-[#202324] p-5 text-white">
        <h1 className="text-xl font-semibold">Account settings unavailable</h1>
        <p className="mt-2 text-sm text-white/65" role="alert">{error || "Your account settings could not be loaded."}</p>
        <Button type="button" className="mt-4 min-h-11" onClick={() => router.refresh()}>Try again</Button>
      </section>
    );
  }

  const currentAvatar = selectedPreview ?? account.imageUrl;

  return (
    <div className="space-y-5 text-white">
      <section className="rounded-xl border border-white/10 bg-[#202324] p-4 shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 min-[430px]:flex-row min-[430px]:items-center">
          <UserAvatar name={name || account.name} imageUrl={currentAvatar} identity={session?.user.id} className="h-20 w-20 text-2xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Profile photo</h2>
            <p className="mt-1 text-sm leading-6 text-white/65">
              New accounts use the first letter of your name with a consistent color. Upload a photo to personalize it; photos are limited to 5 MB.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                onChange={handleFileChange}
                disabled={pending}
                className="sr-only"
                aria-label="Choose an avatar image"
              />
              <Button type="button" variant="outline" disabled={pending} onClick={() => fileInput.current?.click()} className="min-h-11">
                Choose image
              </Button>
              {selectedFile && (
                <Button type="button" disabled={pending} onClick={uploadAvatar} className="min-h-11">
                  {pending ? "Uploading…" : "Upload photo"}
                </Button>
              )}
              {account.image && !selectedFile && (
                <Button type="button" variant="outline" disabled={pending} onClick={removeAvatar} className="min-h-11">
                  Use initials
                </Button>
              )}
            </div>
            {selectedFile && <p className="mt-2 break-all text-xs text-white/55">Selected: {selectedFile.name}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#202324] p-4 shadow-lg sm:p-6">
        <h2 className="text-lg font-semibold">Personal information</h2>
        <p className="mt-1 text-sm leading-6 text-white/65">
          Your name and avatar appear beside reviews and on your seller storefront. Your sign-in email stays private.
        </p>
        <form onSubmit={saveProfileAndPreferences} className="mt-5 space-y-5">
          <div className="space-y-2">
            <label htmlFor="account-name" className="text-sm font-medium">Name *</label>
            <Input id="account-name" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} disabled={pending} className={fieldClass} required />
          </div>
          <div className="space-y-2">
            <label htmlFor="account-email" className="text-sm font-medium">Sign-in email</label>
            <Input id="account-email" value={session?.user.email ?? ""} readOnly className={fieldClass + " cursor-not-allowed opacity-70"} />
            <p className="text-xs leading-5 text-white/50">Email changes require a separate verified-email workflow and are not enabled here.</p>
          </div>

          <div className="border-t border-white/10 pt-5">
            <h3 className="font-semibold">Browsing preferences</h3>
            <p className="mt-1 text-sm leading-6 text-white/65">These defaults are applied whenever you open Find homes. Search filters in the URL still take precedence.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="account-default-sort" className="text-sm font-medium">Default sort order</label>
                <select id="account-default-sort" value={preferences.defaultSort} onChange={(event) => changePreference("defaultSort", event.target.value as DefaultListingSort)} disabled={pending} className={fieldClass}>
                  <option value="newest">Newest first</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="account-view-mode" className="text-sm font-medium">Results layout</label>
                <select id="account-view-mode" value={preferences.viewMode} onChange={(event) => changePreference("viewMode", event.target.value as ListingViewMode)} disabled={pending} className={fieldClass}>
                  <option value="grid">Property grid</option>
                  <option value="list">Single column</option>
                </select>
              </div>
            </div>
          </div>

          {error && <p role="alert" className="rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
          {notice && <p role="status" className="rounded-md border border-green-400/25 bg-green-950/25 p-3 text-sm text-green-200">{notice}</p>}
          <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">{pending ? "Saving…" : "Save profile and preferences"}</Button>
        </form>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#202324] p-4 shadow-lg sm:p-6">
        <h2 className="text-lg font-semibold">Password and security</h2>
        <p className="mt-1 text-sm leading-6 text-white/65">Change your password. Other active sessions will be signed out after a successful change.</p>
        <form onSubmit={changePassword} className="mt-5 space-y-4">
          <div className="space-y-2">
            <label htmlFor="account-current-password" className="text-sm font-medium">Current password</label>
            <Input id="account-current-password" inputType="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={passwordPending} className={fieldClass} required />
          </div>
          <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="account-new-password" className="text-sm font-medium">New password</label>
              <Input id="account-new-password" inputType="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={passwordPending} className={fieldClass} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="account-confirm-password" className="text-sm font-medium">Confirm new password</label>
              <Input id="account-confirm-password" inputType="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={passwordPending} className={fieldClass} required />
            </div>
          </div>
          {passwordError && <p role="alert" className="rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{passwordError}</p>}
          {passwordNotice && <p role="status" className="rounded-md border border-green-400/25 bg-green-950/25 p-3 text-sm text-green-200">{passwordNotice}</p>}
          <Button type="submit" disabled={passwordPending} className="min-h-11 w-full sm:w-auto">{passwordPending ? "Changing password…" : "Change password"}</Button>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
        <Link href="/profile" className="rounded-xl border border-white/10 bg-[#202324] p-4 transition-colors hover:border-[#78b75c]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]">
          <span className="font-semibold">Seller profile</span>
          <p className="mt-1 text-sm leading-6 text-white/60">Manage your public storefront, bio, contact details, and listings.</p>
          <span className="mt-3 inline-flex text-sm text-[#a6d78f]">Manage seller profile →</span>
        </Link>
        <Link href="/Saved" className="rounded-xl border border-white/10 bg-[#202324] p-4 transition-colors hover:border-[#78b75c]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]">
          <span className="font-semibold">Saved homes</span>
          <p className="mt-1 text-sm leading-6 text-white/60">Return to properties you have saved for later.</p>
          <span className="mt-3 inline-flex text-sm text-[#a6d78f]">View saved homes →</span>
        </Link>
      </section>
    </div>
  );
}
