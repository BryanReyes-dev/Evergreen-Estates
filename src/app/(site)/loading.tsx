import { LoadingState } from "@/components/ui/loading-state";

export default function SiteLoading() {
  return (
    <main className="min-h-[60vh] bg-[#141616]">
      <LoadingState label="Loading Evergreen Estates…" size="lg" fullScreen />
    </main>
  );
}
