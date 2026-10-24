import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountSettingsForm } from "@/components/forms/AccountSettingsForm";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/auth");

  return (
    <main className="mx-auto min-h-[65vh] w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a6d78f]">Your account</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Account settings</h1>
        <p className="max-w-2xl text-sm leading-6 text-white/65">
          Manage your personal profile, avatar, security, and the way property results are displayed.
        </p>
      </header>
      <AccountSettingsForm />
      <p className="text-xs leading-5 text-white/45">
        Account information is private by default. Your name and avatar are shown publicly beside reviews and on a published seller profile.
      </p>
      <Link href="/search" className="inline-flex min-h-11 items-center text-sm text-white/70 underline underline-offset-4 hover:text-white">Back to Find homes</Link>
    </main>
  );
}
