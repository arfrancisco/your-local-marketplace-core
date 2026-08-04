module Api
  module V1
    # A conversation is looked up by its order_id (one per order) rather than
    # its own id — shared between customer and vendor (ConversationPolicy
    # unifies ownership for both sides).
    class ConversationsController < BaseController
      before_action :set_conversation

      # GET /api/v1/orders/:id/conversation
      def show
        render json: { conversation: { id: @conversation.id, order_id: @conversation.order_id },
                       messages: @conversation.messages.order(:created_at).map { |m| MessageSerializer.call(m) } }
      end

      # POST /api/v1/orders/:id/messages (body, image)
      def create_message
        message = Messaging::PostMessage.new(
          conversation: @conversation,
          sender_user: current_user,
          message_type: params[:image].present? ? "image" : "text",
          body: params[:body],
          image: params[:image]
        ).call
        render json: { message: MessageSerializer.call(message) }, status: :created
      end

      # POST /api/v1/orders/:id/conversation/mark_read
      def mark_read
        read = ConversationRead.find_or_initialize_by(conversation: @conversation, user: current_user)
        read.last_read_message_id = @conversation.messages.maximum(:id)
        read.last_read_at = Time.current
        read.save!
        head :no_content
      end

      private

      def set_conversation
        order = Order.find(params[:id])
        @conversation = order.conversation
        raise ApiError::NotFound, "This order has no conversation yet" if @conversation.nil?

        authorize @conversation, action_name == "create_message" ? :post_message? : :show?
      end
    end
  end
end
