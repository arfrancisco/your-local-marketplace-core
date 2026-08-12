require "rails_helper"

RSpec.describe Carts::Checkout do
  let(:customer) { create(:user, :customer, :mobile_verified) }
  let(:shop) { create(:shop, :open, fulfillment_methods: %w[pickup delivery]) }
  let(:item) { create(:item, shop: shop, price_cents: 15_000) }
  let(:cart) do
    Carts::AddItem.new(customer_profile: customer.customer_profile, shop: shop, item: item, quantity: 2).call
  end

  it "creates an order snapshotted from the cart, marks the cart converted, and creates a conversation" do
    order = described_class.new(cart: cart, fulfillment_method: "pickup").call

    expect(order).to be_persisted
    expect(order.status).to eq("placed")
    expect(order.subtotal_cents).to eq(30_000)
    expect(order.total_cents).to eq(30_000)
    expect(order.order_items.sole).to have_attributes(item_name: item.name, unit_price_cents: 15_000, quantity: 2)
    expect(cart.reload.status).to eq("converted")
    expect(order.conversation).to be_present
    expect(order.order_status_events.sole).to have_attributes(from_status: nil, to_status: "placed")
  end

  it "posts a system chat message announcing the order was placed, from the customer" do
    order = described_class.new(cart: cart, fulfillment_method: "pickup").call

    message = order.conversation.messages.sole
    expect(message.message_type).to eq("system")
    expect(message.body).to eq("Order placed.")
    expect(message.sender_user).to eq(customer)
  end

  it "rejects checkout for an empty cart" do
    empty_cart = create(:cart, customer_profile: customer.customer_profile, shop: shop)
    expect { described_class.new(cart: empty_cart, fulfillment_method: "pickup").call }
      .to raise_error(ApiError::UnprocessableEntity, /empty/i)
  end

  it "rejects a fulfillment method the shop doesn't offer" do
    shop.update!(fulfillment_methods: %w[pickup])
    expect { described_class.new(cart: cart, fulfillment_method: "delivery").call }
      .to raise_error(ApiError::UnprocessableEntity, /fulfillment/i)
  end

  it "rejects checkout when an item has been disabled since it was added to the cart" do
    cart # force creation while the item is still enabled
    item.update!(enabled: false)
    expect { described_class.new(cart: cart, fulfillment_method: "pickup").call }
      .to raise_error(ApiError::UnprocessableEntity, /no longer available/i)
  end

  it "rejects checkout when an item's stock has run out since it was added to the cart" do
    cart # force creation while the item still has stock
    item.update!(stock_count: 0)
    expect { described_class.new(cart: cart, fulfillment_method: "pickup").call }
      .to raise_error(ApiError::UnprocessableEntity, /no longer available/i)
  end

  it "rejects checkout when an item has been archived since it was added to the cart" do
    cart # force creation while the item is still active
    item.archive!
    expect { described_class.new(cart: cart, fulfillment_method: "pickup").call }
      .to raise_error(ApiError::UnprocessableEntity, /no longer available/i)
  end

  it "rejects checkout for a customer whose mobile number isn't verified" do
    unverified = create(:user, :customer)
    unverified_cart = Carts::AddItem.new(
      customer_profile: unverified.customer_profile, shop: shop, item: item, quantity: 1
    ).call

    expect { described_class.new(cart: unverified_cart, fulfillment_method: "pickup").call }
      .to raise_error(ApiError) { |e| expect(e.code).to eq("mobile_not_verified"); expect(e.status).to eq(:forbidden) }
  end

  it "allows checkout for a customer with a verified mobile number" do
    order = described_class.new(cart: cart, fulfillment_method: "pickup").call
    expect(order).to be_persisted
  end

  it "allows checkout for a customer verified by email only, if their account predates mobile verification becoming mandatory" do
    legacy_customer = create(
      :user, :customer, :email_verified,
      created_at: Carts::Checkout::MOBILE_VERIFICATION_MANDATORY_SINCE - 1.day
    )
    legacy_cart = Carts::AddItem.new(
      customer_profile: legacy_customer.customer_profile, shop: shop, item: item, quantity: 1
    ).call

    order = described_class.new(cart: legacy_cart, fulfillment_method: "pickup").call
    expect(order).to be_persisted
  end

  it "rejects checkout for a customer verified by email only, if their account was created after mobile verification became mandatory" do
    new_customer = create(
      :user, :customer, :email_verified,
      created_at: Carts::Checkout::MOBILE_VERIFICATION_MANDATORY_SINCE + 1.day
    )
    new_cart = Carts::AddItem.new(
      customer_profile: new_customer.customer_profile, shop: shop, item: item, quantity: 1
    ).call

    expect { described_class.new(cart: new_cart, fulfillment_method: "pickup").call }
      .to raise_error(ApiError) { |e| expect(e.code).to eq("mobile_not_verified") }
  end

  it "rejects checkout for a customer under a cancellation-abuse restriction" do
    customer.customer_profile.update!(cancellation_restricted_at: Time.current)

    expect { described_class.new(cart: cart, fulfillment_method: "pickup").call }
      .to raise_error(ApiError) { |e| expect(e.code).to eq("cancellation_restricted"); expect(e.status).to eq(:forbidden) }
  end

  it "enqueues OrderNotificationJob with the 'placed' event row's id" do
    order = nil
    expect {
      order = described_class.new(cart: cart, fulfillment_method: "pickup").call
    }.to have_enqueued_job(OrderNotificationJob)

    placed_event = order.order_status_events.find_by(to_status: "placed")
    expect(placed_event).to be_present
    expect(OrderNotificationJob).to have_been_enqueued.with(placed_event.id)
  end

  describe "in-flight order cap" do
    def place_order(customer_profile:, item:, shop:)
      order_cart = Carts::AddItem.new(customer_profile: customer_profile, shop: shop, item: item, quantity: 1).call
      described_class.new(cart: order_cart, fulfillment_method: "pickup").call
    end

    it "rejects checkout once the customer already has 3 in-flight orders" do
      3.times { place_order(customer_profile: customer.customer_profile, item: item, shop: shop) }

      expect { described_class.new(cart: cart, fulfillment_method: "pickup").call }
        .to raise_error(ApiError) { |e|
          expect(e.code).to eq("too_many_in_flight_orders")
          expect(e.status).to eq(:forbidden)
        }
    end

    it "succeeds again once one of the 3 in-flight orders reaches a terminal status" do
      orders = Array.new(3) { place_order(customer_profile: customer.customer_profile, item: item, shop: shop) }
      orders.first.update!(status: "rejected")

      order = described_class.new(cart: cart, fulfillment_method: "pickup").call
      expect(order).to be_persisted
    end

    it "does not count another customer's in-flight orders" do
      other_customer = create(:user, :customer, :mobile_verified)
      3.times { place_order(customer_profile: other_customer.customer_profile, item: item, shop: shop) }

      order = described_class.new(cart: cart, fulfillment_method: "pickup").call
      expect(order).to be_persisted
    end

    it "locks the customer_profile row before checking the count, so a concurrent checkout for the same customer can't slip past the cap" do
      # Same shape of proof as Orders::TransitionStatus's row-lock spec: a
      # single-threaded test can't reproduce true concurrent contention, but
      # it can prove the lock is actually part of the code path the cap
      # depends on, not just present somewhere unrelated in the file.
      expect(cart.customer_profile).to receive(:lock!).and_call_original

      described_class.new(cart: cart, fulfillment_method: "pickup").call
    end
  end
end
