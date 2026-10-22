import type { Review as ReviewType } from "@/app/types";
import { ReviewActions } from "@/components/ReviewActions";
import { UserAvatar } from "@/components/UserAvatar";

interface ReviewProps {
  review: ReviewType;
}

export const Review = ({ review }: ReviewProps) => {
  return (
    <article className="border-b border-white/10 py-6 last:border-b-0">
      <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            name={review.user.name}
            imageUrl={review.user.image}
            identity={review.user.id}
            className="h-10 w-10 text-sm"
          />
          <div className="min-w-0">
            <h3 className="break-words font-maitree text-base font-semibold text-white sm:text-lg">
              {review.user.name}
            </h3>
            <p className="mt-1 text-sm text-white/60">
              {new Date(review.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 min-[420px]:pt-1" aria-label={"Rating: " + review.rating + " out of 5"}>
          <span className="text-sm text-white">{review.rating}</span>
          <span className="text-white" aria-hidden="true">★</span>
        </div>
      </div>

      <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words text-[15px] leading-7 text-white/80">
        {review.comment}
      </p>

      <ReviewActions review={review} />
    </article>
  );
};
