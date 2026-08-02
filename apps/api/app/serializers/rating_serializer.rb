module RatingSerializer
  module_function

  # Reviews are public (they show on the shop's page to anyone browsing), so
  # this deliberately exposes only a display name, never the reviewer's id or
  # contact details.
  def call(rating)
    {
      id: rating.id,
      score: rating.score,
      comment: rating.comment,
      reviewer_display_name: reviewer_display_name(rating),
      created_at: rating.created_at
    }
  end

  def reviewer_display_name(rating)
    rating.reviewer_user.customer_profile&.display_name.presence || rating.reviewer_user.email
  end
end
