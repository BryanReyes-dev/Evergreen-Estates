import { notFound } from "next/navigation";
import MediaUploadTest from "@/components/dev/MediaUploadTest";

export default function DevMediaUploadPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <MediaUploadTest />;
}