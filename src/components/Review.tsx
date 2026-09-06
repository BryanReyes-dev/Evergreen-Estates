interface ReviewProps {
  user_id: string;
}

export const Review = ({ user_id }: ReviewProps) => {
  return (
    <article>
      {/* user */}
      {/* rating */}
      user_id: {user_id}
      {/* comment */}
      {/* date */}
    </article>
  );
};

