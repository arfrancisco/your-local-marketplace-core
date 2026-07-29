class CustomerProfile < ApplicationRecord
  belongs_to :user
  belongs_to :default_address, class_name: "Address", optional: true

  validates :display_name, presence: true
  validates :user_id, uniqueness: true
end
