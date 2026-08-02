module Api
  module V1
    module Admin
      # Show only — a full transcript for dispute resolution/support. No
      # index; conversations are looked up per-order, not browsed globally.
      class ConversationsController < BaseController
        def show
          conversation = Conversation.find(params[:id])
          render json: {
            conversation: {
              id: conversation.id,
              order_id: conversation.order_id,
              messages: conversation.messages.order(:created_at).map { |m| MessageSerializer.call(m) }
            }
          }
        end
      end
    end
  end
end
