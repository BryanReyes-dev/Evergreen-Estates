"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { getSignUpErrorMessage } from "@/lib/auth-error-messages";
import { DEMO_ACCOUNT_RETENTION_NOTICE } from "@/lib/demo-mode";

type AuthMode = "sign-in" | "sign-up";
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const absoluteUrl = (path: string) => new URL(path, window.location.origin).toString();

export function AuthForm({ demoModeEnabled }: { demoModeEnabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [demoSignupReady, setDemoSignupReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function resendVerification() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!validEmail(normalizedEmail)) {
      setError("Enter a valid email address first.");
      return;
    }
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email: normalizedEmail,
        callbackURL: absoluteUrl("/profile"),
      });
      setNotice(result.error
        ? "If this address belongs to an unverified account, a link may be sent. Please wait before trying again."
        : "If this address belongs to an unverified account, a link has been sent. Check your inbox and spam folder.");
    } catch {
      setNotice("We could not submit the request right now. Please try again later.");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setNeedsVerification(false);

    const normalizedEmail = email.trim().toLowerCase();
    if (!validEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }
    if (mode === "sign-up" && !name.trim()) {
      setError("Enter your name to create an account.");
      return;
    }
    if (mode === "sign-up" && name.trim().length > 100) {
      setError("Your name must be 100 characters or fewer.");
      return;
    }

    setPending(true);
    try {
      if (mode === "sign-in") {
        const result = await authClient.signIn.email({ email: normalizedEmail, password });
        if (result.error) {
          if (result.error.status === 403 || result.error.code === "EMAIL_NOT_VERIFIED") {
            setNeedsVerification(true);
            setError("Please verify your email address before signing in.");
          } else {
            setError("Sign in failed. Check your email and password and try again.");
          }
          return;
        }
        router.replace("/profile");
        router.refresh();
        return;
      }

      const result = await authClient.signUp.email({
        name: name.trim(),
        email: normalizedEmail,
        password,
        callbackURL: absoluteUrl("/profile"),
      });
      if (result.error) {
        setError(getSignUpErrorMessage(result.error.code));
        return;
      }
      setPassword("");
      if (demoModeEnabled) {
        // Better Auth auto-creates a session in demo mode; the user explicitly
        // chooses to continue without clicking an email verification link.
        setDemoSignupReady(true);
        setNotice(DEMO_ACCOUNT_RETENTION_NOTICE);
        return;
      }
      setVerificationSent(true);
      setNotice("If this address can receive account email, a verification link has been sent. The link expires in one hour.");
    } catch {
      setError(mode === "sign-in"
        ? "Sign in is temporarily unavailable. Try again."
        : "Account creation is temporarily unavailable. Try again.");
    } finally {
      setPending(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setNeedsVerification(false);
    setVerificationSent(false);
    setDemoSignupReady(false);
  }

  if (verificationSent) {
    return (
      <section className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-[#202324] p-4 text-white shadow-lg sm:p-7">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          We have processed the sign-up request for <strong>{email.trim()}</strong>. Follow the verification link before signing in.
        </p>
        <p className="mt-3 block text-sm leading-6 text-white/70" aria-live="polite">{notice}</p>
        <Button type="button" onClick={resendVerification} disabled={resending} className="mt-5 min-h-11 w-full">
          {resending ? "Sending…" : "Resend verification email"}
        </Button>
        <button type="button" onClick={() => changeMode("sign-in")} className="mt-4 min-h-11 w-full text-sm underline underline-offset-4 hover:text-[#a9d593]">Back to sign in</button>
      </section>
    );
  }

  if (demoSignupReady) {
    return (
      <section className="mx-auto w-full max-w-md rounded-xl border border-amber-300/30 bg-[#202324] p-4 text-white shadow-lg sm:p-7">
        <h1 className="text-2xl font-semibold">Temporary development account created</h1>
        <p className="mt-3 text-sm leading-6 text-amber-100/90">{DEMO_ACCOUNT_RETENTION_NOTICE}</p>
        <Button
          type="button"
          onClick={() => {
            router.replace("/profile");
            router.refresh();
          }}
          className="mt-5 min-h-11 w-full"
        >
          Skip email verification and continue
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-[#202324] p-4 text-white shadow-lg sm:p-7">
      <h1 className="text-2xl font-semibold">{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-2 text-sm leading-6 text-white/70">
        {mode === "sign-in"
          ? "Sign in to manage your seller profile, listings, and reviews."
          : demoModeEnabled
            ? "Create a temporary development account to manage your seller profile, listings, and reviews without email verification."
            : "Create an account to set up your seller profile and publish listings. Verify your email before signing in."}
      </p>

      <div className="mt-5 grid grid-cols-2 rounded-lg bg-black/20 p-1" aria-label="Authentication mode">
        <button type="button" onClick={() => changeMode("sign-in")} aria-pressed={mode === "sign-in"} className="min-h-11 rounded-md px-3 text-sm font-medium aria-pressed:bg-[#78b75c] aria-pressed:text-black">Sign in</button>
        <button type="button" onClick={() => changeMode("sign-up")} aria-pressed={mode === "sign-up"} className="min-h-11 rounded-md px-3 text-sm font-medium aria-pressed:bg-[#78b75c] aria-pressed:text-black">Create account</button>
      </div>

      {demoModeEnabled && mode === "sign-up" && (
        <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-950/25 p-3 text-sm leading-6 text-amber-100" role="status">
          <p className="font-semibold">Development/demo mode only</p>
          <p className="mt-1">{DEMO_ACCOUNT_RETENTION_NOTICE}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {mode === "sign-up" && <div className="space-y-2">
          <label htmlFor="auth-name" className="text-sm font-medium">Full name</label>
          <Input id="auth-name" name="name" autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} disabled={pending} />
        </div>}
        <div className="space-y-2">
          <label htmlFor="auth-email" className="text-sm font-medium">Email</label>
          <Input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="auth-password" className="text-sm font-medium">Password</label>
          <Input id="auth-password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} />
          {mode === "sign-up" && <p className="text-xs text-white/60">Use 8–128 characters.</p>}
          {mode === "sign-in" && <p className="text-right text-sm"><Link href="/auth/forgot-password" className="underline underline-offset-4 hover:text-[#a9d593]">Forgot password?</Link></p>}
        </div>
        {error && <p className="rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p>}
        {needsVerification && <Button type="button" variant="outline" onClick={resendVerification} disabled={resending} className="min-h-11 w-full">{resending ? "Sending…" : "Resend verification email"}</Button>}
        {notice && <p className="block text-sm text-white/75" aria-live="polite">{notice}</p>}
        <Button type="submit" disabled={pending} className="min-h-11 w-full">{pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</Button>
      </form>
      <p className="mt-5 text-sm text-white/60">You can browse homes without an account.{" "}<Link href="/search" className="underline underline-offset-4 hover:text-white">Browse listings</Link></p>
    </section>
  );
}
