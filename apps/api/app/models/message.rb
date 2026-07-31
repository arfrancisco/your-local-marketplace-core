class Message < ApplicationRecord
  include ImageAttachable

  belongs_to :conversation
  belongs_to :sender_user, class_name: "User", optional: true # nil for system messages
  has_images :image, max_count: 1

  TYPES = %w[text image system].freeze

  validates :message_type, inclusion: { in: TYPES }
  validate :body_or_image_present

  private

  def body_or_image_present
    return if body.present? || image.attached?

    errors.add(:base, "must have a body or an image")
  end
end
