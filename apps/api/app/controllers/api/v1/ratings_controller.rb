module Api
  module V1
    # Customer leaves a public review on one of their completed orders.
    # Authorization is two-layered on purpose: OrderPolicy#show? gates the
    # order to its two participants (the same check every other order route
    # uses), and Ratings::Create then enforces the customer-only rule, since
    # "who may rate" is a business rule about the rating, not about the order.
    class RatingsController < BaseController
      before_action :set_order

      # POST /api/v1/orders/:id/ratings (score, comment)
      def create
        rating = Ratings::Create.new(
          order: @order,
          reviewer_user: current_user,
          score: params.require(:score),
          comment: params[:comment]
        ).call

        render json: { rating: RatingSerializer.call(rating) }, status: :created
      end

      private

      def set_order
        @order = Order.find(params[:id])
        authorize @order, :show?
      end
    end
  end
end
