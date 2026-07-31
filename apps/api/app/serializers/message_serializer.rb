module MessageSerializer
  module_function

  def call(message)
    {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_user_id: message.sender_user_id,
      message_type: message.message_type,
      body: message.body,
      image: message.image.attached? ? PhotoSerializer.one(message.image.first) : nil,
      created_at: message.created_at,
      edited_at: message.edited_at
    }
  end
end
