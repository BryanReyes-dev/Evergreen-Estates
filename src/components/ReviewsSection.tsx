import {Review} from "./Review";


interface ReviewsSectionProps {
  listingId: string;
}

export const ReviewsSection = ({ listingId }: ReviewsSectionProps) => {
  // Get reviews for this listing
  const reviews = [
    { id: "1", user_id: "user1" },
    { id: "2", user_id: "user2" },
    { id: "3", user_id: "user3" },
  ];

  return (
    <section>
      {/* review summary */}
      {reviews.map((review) => (
          <Review user_id={review.user_id} key={review.id} />
        ))}

      {/* reviews */}
      
       
    </section>
  );
};