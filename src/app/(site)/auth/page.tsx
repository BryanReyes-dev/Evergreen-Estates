import { AuthForm } from "@/components/forms/AuthForm";
import { isDemoAuthBypassEnabled } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  return (
    <main className="min-h-[70vh] px-4 py-8 sm:py-12">
      <AuthForm demoModeEnabled={isDemoAuthBypassEnabled()} />
    </main>
  );
}
