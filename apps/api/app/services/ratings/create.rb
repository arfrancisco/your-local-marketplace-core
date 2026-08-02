module Ratings
  # The only way a rating is written. Enforces the two business rules that
  # aren't expressible as a Pundit check on the order alone: the order must be
  # finished, and only the customer side rates this phase (the vendor can read
  # their standing but not review back yet — the polymorphic reviewee leaves
  # room for that later).
  class Create
    def initialize(order:, reviewer_user:, score:, comment: nil)
      @order = order
      @reviewer_user = reviewer_user
      @score = score
      @comment = comment
    end

    def call
      unless @order.status == "completed"
        raise ApiError::UnprocessableEntity, "An order can only be rated once it is completed"
      end

      unless @reviewer_user == @order.customer_profile.user
        raise ApiError::Forbidden, "Only the order's customer may rate it"
      end

      Rating.create!(
        order: @order,
        reviewer_user: @reviewer_user,
        reviewee: @order.shop,
        score: @score,
        comment: @comment
      )
    end
  end
end
