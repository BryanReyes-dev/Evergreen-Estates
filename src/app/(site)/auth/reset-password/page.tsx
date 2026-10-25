import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";

type ResetPasswordSearchParams = {
  token?: string | string[];
  error?: string | string[];
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<ResetPasswordSearchParams>;
}) {
  const params = await searchParams;
  const tokenParam = typeof params.token === "string" ? params.token : null;
  const hasError = typeof params.error === "string" && params.error.length > 0;

  return (
    <main className="min-h-[70vh] px-4 py-8 sm:py-12">
      <ResetPasswordForm tokenParam={tokenParam} hasError={hasError} />
    </main>
  );
}
