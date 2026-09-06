import { Review } from "./Review";
import type { Review as ReviewType } from "@/app/types";

interface ReviewsSectionProps {
  reviews: ReviewType[];
}

export const ReviewsSection = ({ reviews }: ReviewsSectionProps) => {
  return (
    <section>
      {/* review summary */}

      {/* reviews */}
      {reviews.map((review) => (
        <Review
          key={review.id}
          review={review}
        />
      ))}
    </section>
  );
};