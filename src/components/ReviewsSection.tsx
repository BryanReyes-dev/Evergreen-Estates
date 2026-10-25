import type { Review as ReviewType } from "@/app/types";
import { Review } from "./Review";
import { ReviewForm } from "@/components/forms/ReviewForm";

interface ReviewsSectionProps {
  listingId: string;
  reviews: ReviewType[];
}

export const ReviewsSection = ({ listingId, reviews }: ReviewsSectionProps) => {
  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <h2 className="text-2xl font-semibold text-white">
          Reviews <span className="text-base font-normal text-white/60">({reviews.length})</span>
        </h2>

        {reviews.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/60">
            This property has no reviews yet. Be the first to share your experience.
          </p>
        ) : (
          <div className="mt-2">
            {reviews.map((review) => (
              <Review key={review.id} review={review} />
            ))}
          </div>
        )}

        <ReviewForm listingId={listingId} />
      </div>
    </section>
  );
};
