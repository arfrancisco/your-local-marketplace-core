require "rails_helper"

RSpec.describe CartItem, type: :model do
  it { is_expected.to belong_to(:cart) }
  it { is_expected.to belong_to(:item) }

  it "requires a positive integer quantity" do
    expect(build(:cart_item, quantity: 0)).not_to be_valid
    expect(build(:cart_item, quantity: -1)).not_to be_valid
  end

  it "does not allow the same item twice in one cart" do
    cart = create(:cart)
    item = create(:item, shop: cart.shop)
    create(:cart_item, cart: cart, item: item)
    expect(build(:cart_item, cart: cart, item: item)).not_to be_valid
  end
end
