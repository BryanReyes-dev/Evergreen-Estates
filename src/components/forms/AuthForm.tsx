"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up";

/** Email/password authentication backed by the existing Better Auth instance. */
export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }
    if (mode === "sign-up" && name.trim().length === 0) {
      setError("Enter your name to create an account.");
      return;
    }
    if (mode === "sign-up" && name.trim().length > 100) {
      setError("Your name must be 100 characters or fewer.");
      return;
    }

    setPending(true);
    try {
      const result =
        mode === "sign-in"
          ? await authClient.signIn.email({
              email: normalizedEmail,
              password,
            })
          : await authClient.signUp.email({
              name: name.trim(),
              email: normalizedEmail,
              password,
            });

      if (result.error) {
        // Avoid printing the auth response: it can include provider details.
        setError(
          mode === "sign-in"
            ? "Sign in failed. Check your email and password and try again."
            : "Your account could not be created. Check the details or try signing in.",
        );
        return;
      }

      router.replace("/profile");
      router.refresh();
    } catch {
      setError(
        mode === "sign-in"
          ? "Sign in is temporarily unavailable. Try again."
          : "Account creation is temporarily unavailable. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-[#202324] p-4 text-white shadow-lg sm:p-7">
      <h1 className="text-2xl font-semibold">
        {mode === "sign-in" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-white/70">
        {mode === "sign-in"
          ? "Sign in to manage your seller profile, listings, and reviews."
          : "Create an account to set up your seller profile and publish listings."}
      </p>

      <div className="mt-5 grid grid-cols-2 rounded-lg bg-black/20 p-1" aria-label="Authentication mode">
        <button
          type="button"
          onClick={() => changeMode("sign-in")}
          aria-pressed={mode === "sign-in"}
          className="min-h-11 rounded-md px-3 text-sm font-medium aria-pressed:bg-[#78b75c] aria-pressed:text-black"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => changeMode("sign-up")}
          aria-pressed={mode === "sign-up"}
          className="min-h-11 rounded-md px-3 text-sm font-medium aria-pressed:bg-[#78b75c] aria-pressed:text-black"
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {mode === "sign-up" && (
          <div className="space-y-2">
            <label htmlFor="auth-name" className="text-sm font-medium">
              Full name
            </label>
            <Input
              id="auth-name"
              name="name"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
            />
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="auth-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="auth-password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
          />
          {mode === "sign-up" && (
            <p className="text-xs text-white/60">Use 8–128 characters.</p>
          )}
        </div>

        {error && (
          <p className="rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="min-h-11 w-full">
          {pending
            ? "Please wait…"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-sm text-white/60">
        You can browse homes without an account.{" "}
        <Link href="/search" className="underline underline-offset-4 hover:text-white">
          Browse listings
        </Link>
      </p>
    </section>
  );
}
