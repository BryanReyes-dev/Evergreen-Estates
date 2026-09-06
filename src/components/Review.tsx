import type { Review as ReviewType } from "@/app/types";

interface ReviewProps {
  review: ReviewType;
}

export const Review = ({ review }: ReviewProps) => {
  return (
    <article className="border-b border-[#474848]/15 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-maitree text-lg text-white">
            {review.user.name}
          </h3>

          <p className="mt-1 font-kanit text-sm text-text-white/60">
            {new Date(review.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <span className="font-kanit text-sm text-white">
            {review.rating}
          </span>

          <span className="text-white">★</span>
        </div>
      </div>

      <p className="mt-4 max-w-2xl font-kanit text-[15px] leading-7 text-white/80">
        {review.comment}
      </p>
    </article>
  );
};