class Tag < ApplicationRecord
  has_many :item_tags, dependent: :destroy
  has_many :items, through: :item_tags

  before_validation :generate_slug

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true

  # Resolves a list of free-text tag names to Tag records, creating any that do
  # not exist yet. Slug is the identity, so "Fresh Bread" and "fresh bread"
  # collapse to one tag.
  def self.for_names(names)
    Array(names).map { |n| n.to_s.strip }.reject(&:blank?).uniq.map do |name|
      find_or_create_by!(slug: name.parameterize) { |tag| tag.name = name }
    end
  end

  private

  def generate_slug
    self.slug = name.to_s.parameterize if slug.blank? && name.present?
  end
end
