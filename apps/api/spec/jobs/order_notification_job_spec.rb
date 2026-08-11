require "rails_helper"

RSpec.describe OrderNotificationJob do
  let(:vendor_user) { create(:user, :vendor, mobile_number: "+639171111111", first_name: "Vic") }
  let(:shop) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile, name: "Bread Pitt") }
  let(:customer_user) do
    create(:user, :customer, mobile_number: "+639172222222", first_name: "Maria", last_name: "Santos")
  end
  let(:order) do
    create(:order, :with_conversation, shop: shop, customer_profile: customer_user.customer_profile, status: "placed")
  end

  def create_event(to_status:, from_status: nil, actor_user: customer_user)
    order.order_status_events.create!(from_status: from_status, to_status: to_status, actor_user: actor_user)
  end

  def ref
    order.public_reference.delete_prefix("ORD-")
  end

  before do
    @original_env = ENV.to_hash
    ENV.delete("APP_BASE_URL")
    ENV.delete("CORS_ORIGINS")
  end

  after { ENV.replace(@original_env) }

  it "bails silently when the order_status_event row is gone" do
    expect(Semaphore::Client).not_to receive(:send_message)
    expect { described_class.perform_now(-1) }.not_to raise_error
  end

  describe "'placed' -> vendor" do
    it "sends the vendor the new-order message with the customer's short name and reference" do
      event = create_event(to_status: "placed")

      expect(Semaphore::Client).to receive(:send_message) do |number:, text:|
        link = ShortLink.sole
        expect(number).to eq(vendor_user.mobile_number)
        expect(link.audience).to eq("vendor")
        expect(text).to eq(
          "KapitMarket: New order from Maria S. (#{ref})! Please review, accept/reject, and arrange payment: " \
          "https://prisma.kapitmarket.ph/s/#{link.code}"
        )
      end

      described_class.perform_now(event.id)
    end

    it "falls back to first name alone when the customer has no last_name" do
      customer_user.update!(last_name: nil)
      event = create_event(to_status: "placed")

      expect(Semaphore::Client).to receive(:send_message) do |number:, text:|
        expect(text).to include("New order from Maria (#{ref})!")
      end

      described_class.perform_now(event.id)
    end

    it "reuses the same short link across repeated notifications for the same order+audience" do
      first_event = create_event(to_status: "placed")
      allow(Semaphore::Client).to receive(:send_message)
      described_class.perform_now(first_event.id)
      first_code = ShortLink.sole.code

      order.update!(status: "placed") # re-arm for a second synthetic event
      second_event = create_event(to_status: "placed", from_status: "placed")
      described_class.perform_now(second_event.id)

      expect(ShortLink.count).to eq(1)
      expect(ShortLink.sole.code).to eq(first_code)
    end

    it "skips silently when the vendor has no mobile number" do
      vendor_user.update!(mobile_number: nil)
      event = create_event(to_status: "placed")

      expect(Semaphore::Client).not_to receive(:send_message)
      described_class.perform_now(event.id)
    end

    it "skips silently when the vendor has opted out of new-order notifications" do
      vendor_user.update!(sms_notify_order_placed: false)
      event = create_event(to_status: "placed")

      expect(Semaphore::Client).not_to receive(:send_message)
      described_class.perform_now(event.id)
    end
  end

  describe "'accepted' -> customer" do
    before { order.update!(status: "accepted") }

    it "sends the customer the accepted message with the shop name" do
      event = create_event(to_status: "accepted", from_status: "placed", actor_user: vendor_user)

      expect(Semaphore::Client).to receive(:send_message) do |number:, text:|
        link = ShortLink.sole
        expect(number).to eq(customer_user.mobile_number)
        expect(link.audience).to eq("customer")
        expect(text).to eq(
          "KapitMarket: Your order from Bread Pitt (#{ref}) was accepted! Message the vendor to coordinate: " \
          "https://prisma.kapitmarket.ph/s/#{link.code}"
        )
      end

      described_class.perform_now(event.id)
    end

    it "skips silently when the customer has no mobile number" do
      customer_user.update!(mobile_number: nil)
      event = create_event(to_status: "accepted", from_status: "placed", actor_user: vendor_user)

      expect(Semaphore::Client).not_to receive(:send_message)
      described_class.perform_now(event.id)
    end

    it "skips silently when the customer has opted out of accepted notifications" do
      customer_user.update!(sms_notify_order_accepted: false)
      event = create_event(to_status: "accepted", from_status: "placed", actor_user: vendor_user)

      expect(Semaphore::Client).not_to receive(:send_message)
      described_class.perform_now(event.id)
    end
  end

  describe "'ready_for_pickup' -> customer" do
    before { order.update!(status: "ready_for_pickup") }

    it "sends the ready-for-pickup message" do
      event = create_event(to_status: "ready_for_pickup", from_status: "preparing", actor_user: vendor_user)

      expect(Semaphore::Client).to receive(:send_message) do |number:, text:|
        link = ShortLink.sole
        expect(number).to eq(customer_user.mobile_number)
        expect(text).to eq(
          "KapitMarket: Your order from Bread Pitt (#{ref}) is ready for pickup! Message the vendor for details: " \
          "https://prisma.kapitmarket.ph/s/#{link.code}"
        )
      end

      described_class.perform_now(event.id)
    end
  end

  describe "'out_for_delivery' -> customer" do
    before { order.update!(status: "out_for_delivery") }

    it "sends the out-for-delivery message" do
      event = create_event(to_status: "out_for_delivery", from_status: "preparing", actor_user: vendor_user)

      expect(Semaphore::Client).to receive(:send_message) do |number:, text:|
        link = ShortLink.sole
        expect(text).to eq(
          "KapitMarket: Your order from Bread Pitt (#{ref}) is out for delivery! Message the vendor if needed: " \
          "https://prisma.kapitmarket.ph/s/#{link.code}"
        )
      end

      described_class.perform_now(event.id)
    end
  end

  describe "'completed' -> customer" do
    before { order.update!(status: "completed") }

    it "sends the completed message" do
      event = create_event(to_status: "completed", from_status: "ready_for_pickup", actor_user: vendor_user)

      expect(Semaphore::Client).to receive(:send_message) do |number:, text:|
        link = ShortLink.sole
        expect(text).to eq(
          "KapitMarket: Your order from Bread Pitt (#{ref}) is complete! Please rate your experience: " \
          "https://prisma.kapitmarket.ph/s/#{link.code}"
        )
      end

      described_class.perform_now(event.id)
    end

    it "skips silently when the customer has opted out of completed notifications" do
      customer_user.update!(sms_notify_order_completed: false)
      event = create_event(to_status: "completed", from_status: "ready_for_pickup", actor_user: vendor_user)

      expect(Semaphore::Client).not_to receive(:send_message)
      described_class.perform_now(event.id)
    end
  end

  describe "shop name truncation" do
    it "truncates a long shop name to 20 chars with a trailing ellipsis, without touching the stored name" do
      long_name = "The Best Pun-tastic Sandwich Shop in Town"
      shop.update!(name: long_name)
      order.update!(status: "accepted")
      event = create_event(to_status: "accepted", from_status: "placed", actor_user: vendor_user)

      expect(Semaphore::Client).to receive(:send_message) do |text:, **|
        expect(text).to include("Your order from #{long_name[0, 20]}… (#{ref})")
      end

      described_class.perform_now(event.id)
      expect(shop.reload.name).to eq(long_name)
    end

    it "leaves a shop name of exactly 20 chars or fewer untouched" do
      short_name = "Bread Pitt" # 10 chars
      shop.update!(name: short_name)
      order.update!(status: "accepted")
      event = create_event(to_status: "accepted", from_status: "placed", actor_user: vendor_user)

      expect(Semaphore::Client).to receive(:send_message) do |text:, **|
        expect(text).to include("Your order from #{short_name} (#{ref})")
      end

      described_class.perform_now(event.id)
    end
  end

  describe "base URL resolution" do
    it "uses APP_BASE_URL when set" do
      ENV["APP_BASE_URL"] = "https://custom.example.com"
      event = create_event(to_status: "placed")

      expect(Semaphore::Client).to receive(:send_message) do |text:, **|
        expect(text).to include("https://custom.example.com/s/")
      end

      described_class.perform_now(event.id)
    end

    it "falls back to the first CORS_ORIGINS entry when APP_BASE_URL is unset" do
      ENV["CORS_ORIGINS"] = "https://app.example.com,https://other.example.com"
      event = create_event(to_status: "placed")

      expect(Semaphore::Client).to receive(:send_message) do |text:, **|
        expect(text).to include("https://app.example.com/s/")
      end

      described_class.perform_now(event.id)
    end

    it "falls back to the hardcoded production URL when both are blank" do
      event = create_event(to_status: "placed")

      expect(Semaphore::Client).to receive(:send_message) do |text:, **|
        expect(text).to include("https://prisma.kapitmarket.ph/s/")
      end

      described_class.perform_now(event.id)
    end
  end
end
