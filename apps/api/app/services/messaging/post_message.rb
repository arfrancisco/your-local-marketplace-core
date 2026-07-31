module Messaging
  # Creates a message on an order's conversation and broadcasts it in real
  # time (ActionCable). sender_user is nil for the vendor's auto-posted
  # payment message (message_type: "system", ADR 0009) — every other message
  # has a real sender.
  class PostMessage
    def initialize(conversation:, message_type: "text", sender_user: nil, body: nil, image: nil)
      @conversation = conversation
      @message_type = message_type
      @sender_user = sender_user
      @body = body
      @image = image
    end

    def call
      message = @conversation.messages.new(
        sender_user: @sender_user,
        message_type: @message_type,
        body: @body
      )
      message.image.attach(@image) if @image.present?
      message.save!

      OrderChatChannel.broadcast_to(@conversation, MessageSerializer.call(message))
      message
    end
  end
end
