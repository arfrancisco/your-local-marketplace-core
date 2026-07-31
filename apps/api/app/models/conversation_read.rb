class ConversationRead < ApplicationRecord
  belongs_to :conversation
  belongs_to :user
  belongs_to :last_read_message, class_name: "Message", optional: true
end
