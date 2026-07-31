class Conversation < ApplicationRecord
  belongs_to :order
  has_many :messages, dependent: :destroy
  has_many :conversation_reads, dependent: :destroy
end
