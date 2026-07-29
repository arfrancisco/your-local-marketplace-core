class Address < ApplicationRecord
  belongs_to :user, optional: true

  validates :recipient_name, presence: true
  validates :building, presence: true
end
