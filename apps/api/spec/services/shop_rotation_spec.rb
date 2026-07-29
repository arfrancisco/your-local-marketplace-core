require "rails_helper"

RSpec.describe ShopRotation do
  # Build shops with explicit ids so the (id + day_of_year) % count math is
  # fully determined and the assertion below is exact, not order-of-creation.
  def shop_with_id(id)
    instance_double(Shop, id: id)
  end

  it "orders by (id + day_of_year) % count with id as tiebreaker" do
    shops = [1, 2, 3, 4].map { |id| shop_with_id(id) }
    # Jan 1 => yday 1. keys: (1+1)%4=2, (2+1)%4=3, (3+1)%4=0, (4+1)%4=1
    # => ids sorted by key: 3(0), 4(1), 1(2), 2(3)
    ordered = described_class.order(shops, on: Date.new(2026, 1, 1))
    expect(ordered.map(&:id)).to eq([3, 4, 1, 2])
  end

  it "produces a different leader on a different day" do
    shops = [1, 2, 3, 4].map { |id| shop_with_id(id) }
    day1 = described_class.order(shops, on: Date.new(2026, 1, 1)).first.id
    day2 = described_class.order(shops, on: Date.new(2026, 1, 2)).first.id
    expect(day1).not_to eq(day2)
  end

  it "is not alphabetical: rotation ignores name entirely" do
    # Two shops whose id order is the reverse of their alphabetical order.
    zulu = create(:shop, :open, name: "Zulu Kitchen")
    alpha = create(:shop, :open, name: "Alpha Kitchen")
    # On a day where zulu's key sorts first, the alphabetical loser leads.
    ordered = described_class.order(Shop.listed, on: rotation_day_favoring(zulu, alpha))
    expect(ordered.first).to eq(zulu)
  end

  it "returns an empty list unchanged" do
    expect(described_class.order([])).to eq([])
  end

  # Finds a day-of-year on which `first` sorts ahead of `second`.
  def rotation_day_favoring(first, second)
    (1..366).each do |day|
      on = Date.new(2026, 1, 1) + (day - 1)
      ordered = described_class.order(Shop.listed, on: on)
      return on if ordered.first == first && ordered.last == second
    end
    raise "no rotation day favors the given shop"
  end
end
