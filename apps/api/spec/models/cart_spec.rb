require "rails_helper"

RSpec.describe Cart, type: :model do
  it { is_expected.to belong_to(:customer_profile) }
  it { is_expected.to belong_to(:shop) }

  it "only allows one active cart per customer per shop" do
    profile = create(:customer_profile)
    shop = create(:shop)
    create(:cart, customer_profile: profile, shop: shop, status: "active")

    expect {
      create(:cart, customer_profile: profile, shop: shop, status: "active")
    }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "allows a converted/abandoned cart alongside a new active one for the same shop" do
    profile = create(:customer_profile)
    shop = create(:shop)
    create(:cart, customer_profile: profile, shop: shop, status: "converted")

    expect(create(:cart, customer_profile: profile, shop: shop, status: "active")).to be_persisted
  end

  it "computes the subtotal from live item prices and quantities" do
    cart = create(:cart)
    item_a = create(:item, shop: cart.shop, price_cents: 10_000)
    item_b = create(:item, shop: cart.shop, price_cents: 5_000)
    create(:cart_item, cart: cart, item: item_a, quantity: 2)
    create(:cart_item, cart: cart, item: item_b, quantity: 3)

    expect(cart.subtotal_cents).to eq(2 * 10_000 + 3 * 5_000)
  end
end
