import type { Review as ReviewType } from "@/app/types";
import { ReviewActions } from "@/components/ReviewActions";

interface ReviewProps {
  review: ReviewType;
}

export const Review = ({ review }: ReviewProps) => {
  return (
    <article className="border-b border-white/10 py-6 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-maitree text-lg text-white">
            {review.user.name}
          </h3>
          <p className="mt-1 font-kanit text-sm text-white/60">
            {new Date(review.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-1" aria-label={"Rating: " + review.rating + " out of 5"}>
          <span className="font-kanit text-sm text-white">{review.rating}</span>
          <span className="text-white" aria-hidden="true">★</span>
        </div>
      </div>

      <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words font-kanit text-[15px] leading-7 text-white/80">
        {review.comment}
      </p>

      <ReviewActions review={review} />
    </article>
  );
};
