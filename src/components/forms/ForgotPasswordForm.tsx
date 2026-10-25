"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    try {
      await authClient.requestPasswordReset({
        email: normalizedEmail,
        redirectTo: new URL("/auth/reset-password", window.location.origin).toString(),
      });
      // Use a generic response regardless of whether the identity exists.
      setSubmitted(true);
    } catch {
      setError("The request could not be submitted. Please try again later.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-[#202324] p-4 text-white shadow-lg sm:p-7">
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      <p className="mt-2 text-sm leading-6 text-white/70">Enter the email associated with your account. If the account exists, we will send a password-reset link.</p>
      {submitted ? (
        <div className="mt-5 space-y-4">
          <output className="block rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white/80" aria-live="polite">
            If an account exists for <strong>{email.trim()}</strong>, a reset email will arrive shortly. The link expires in one hour. Check your spam folder too.
          </output>
          <Link href="/auth" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-[#a9d593]">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor="forgot-email" className="text-sm font-medium">Email</label>
            <Input id="forgot-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} />
          </div>
          {error && <p className="rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p>}
          <Button type="submit" className="min-h-11 w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
      <p className="mt-5 text-sm text-white/60">Remembered your password?{" "}<Link href="/auth" className="underline underline-offset-4 hover:text-white">Sign in</Link></p>
    </section>
  );
}
