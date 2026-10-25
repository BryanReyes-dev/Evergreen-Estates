"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ tokenParam, hasError }: { tokenParam: string | null; hasError: boolean }) {
  const token = tokenParam;
  const [invalidLink, setInvalidLink] = useState(hasError || !tokenParam);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setInvalidLink(true);
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError("Choose a password between 8 and 128 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setInvalidLink(true);
        setError("This reset link is invalid, expired, or already used. Request a new one.");
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setComplete(true);
    } catch {
      setError("The password could not be reset. Request a new link and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-[#202324] p-4 text-white shadow-lg sm:p-7">
      <h1 className="text-2xl font-semibold">{complete ? "Password updated" : "Set a new password"}</h1>
      {complete ? (
        <div className="mt-4 space-y-4">
          <output className="block text-sm leading-6 text-white/75" aria-live="polite">Your password has been changed. Other active sessions have been revoked; sign in again with your new password.</output>
          <Link href="/auth" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-[#a9d593]">Sign in</Link>
        </div>
      ) : invalidLink ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-white/75" role="alert">This password-reset link is missing, invalid, expired, or already used. Request a fresh link to continue.</p>
          <Link href="/auth/forgot-password" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-[#a9d593]">Request another reset link</Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-white/70">Choose a new password. Reset links expire after one hour and can be used once.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="reset-password" className="text-sm font-medium">New password</label>
              <Input id="reset-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} />
            </div>
            <div className="space-y-2">
              <label htmlFor="reset-confirm-password" className="text-sm font-medium">Confirm new password</label>
              <Input id="reset-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={pending} />
            </div>
            {error && <p className="rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p>}
            <Button type="submit" className="min-h-11 w-full" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button>
          </form>
        </>
      )}
    </section>
  );
}
