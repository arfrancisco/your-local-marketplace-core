require "rails_helper"

RSpec.describe Orders::CancellationAbuseCheck do
  # Builds and cancels one order in a single step (an OrderStatusEvent
  # created directly, not via Orders::TransitionStatus, so tests can control
  # created_at precisely for window tests) — mirrors what one real
  # cancellation leaves behind.
  def cancelled_order(customer_profile:, shop:, actor_user:, created_at: Time.current)
    order = create(:order, customer_profile: customer_profile, shop: shop, status: "cancelled")
    order.order_status_events.create!(
      from_status: "placed", to_status: "cancelled", actor_user: actor_user, created_at: created_at
    )
    order
  end

  describe "customer role" do
    let(:customer_user) { create(:user, :customer) }
    let(:customer_profile) { customer_user.customer_profile }
    let(:shop) { create(:shop, :open) }

    it "does not restrict after only 2 cancellations in the window" do
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user)
      second = cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user)

      described_class.new(order: second, actor_user: customer_user).call

      expect(customer_profile.reload).not_to be_restricted
      expect(customer_profile.cancellation_restriction_count).to eq(0)
    end

    it "restricts on the 3rd cancellation within the window" do
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user)
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user)
      third = cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user)

      described_class.new(order: third, actor_user: customer_user).call

      expect(customer_profile.reload).to be_restricted
      expect(customer_profile.cancellation_restriction_count).to eq(1)
    end

    it "does not count cancellations older than the 14-day window" do
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user, created_at: 20.days.ago)
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user, created_at: 16.days.ago)
      recent = cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user)

      described_class.new(order: recent, actor_user: customer_user).call

      expect(customer_profile.reload).not_to be_restricted
    end

    it "escalates to a full account suspension on a second trigger after being cleared once" do
      customer_profile.update!(cancellation_restriction_count: 1, cancellation_restricted_at: nil)
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user)
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user)
      third = cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: customer_user)

      described_class.new(order: third, actor_user: customer_user).call

      expect(customer_profile.reload.cancellation_restricted_at).to be_nil
      expect(customer_profile.cancellation_restriction_count).to eq(2)
      expect(customer_user.reload.status).to eq("suspended")
    end
  end

  describe "vendor role" do
    let(:vendor_user) { create(:user, :vendor) }
    let(:vendor_profile) { vendor_user.vendor_profile }
    let(:shop) { create(:shop, :open, vendor_profile: vendor_profile) }
    let(:customer_profile) { create(:customer_profile) }

    it "restricts the vendor profile and closes their shop on the 3rd cancellation within the window" do
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: vendor_user)
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: vendor_user)
      third = cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: vendor_user)

      described_class.new(order: third, actor_user: vendor_user).call

      expect(vendor_profile.reload).to be_restricted
      expect(vendor_profile.cancellation_restriction_count).to eq(1)
      expect(shop.reload.accepting_orders).to be(false)
    end

    it "escalates to a full account suspension on a second trigger, without re-restricting the profile" do
      vendor_profile.update!(cancellation_restriction_count: 1, cancellation_restricted_at: nil)
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: vendor_user)
      cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: vendor_user)
      third = cancelled_order(customer_profile: customer_profile, shop: shop, actor_user: vendor_user)

      described_class.new(order: third, actor_user: vendor_user).call

      expect(vendor_profile.reload.cancellation_restricted_at).to be_nil
      expect(vendor_profile.cancellation_restriction_count).to eq(2)
      expect(vendor_user.reload.status).to eq("suspended")
    end
  end

  describe "a :both-role user" do
    let(:both_user) { create(:user, :customer, :vendor) }
    let(:customer_profile) { both_user.customer_profile }
    let(:vendor_profile) { both_user.vendor_profile }
    let(:own_shop) { create(:shop, :open, vendor_profile: vendor_profile) }
    let(:other_shop) { create(:shop, :open) }
    let(:other_customer) { create(:customer_profile) }

    it "tracks the customer side and vendor side completely independently" do
      # Customer-side: both_user cancels 3 orders as the customer of someone
      # else's shop.
      cancelled_order(customer_profile: customer_profile, shop: other_shop, actor_user: both_user)
      cancelled_order(customer_profile: customer_profile, shop: other_shop, actor_user: both_user)
      third_customer_order = cancelled_order(customer_profile: customer_profile, shop: other_shop, actor_user: both_user)

      # Vendor-side: both_user cancels 2 orders as the vendor of their own
      # shop (belonging to a different customer) — below threshold, and must
      # not spill over into (or be inflated by) the customer-side count.
      cancelled_order(customer_profile: other_customer, shop: own_shop, actor_user: both_user)
      cancelled_order(customer_profile: other_customer, shop: own_shop, actor_user: both_user)

      described_class.new(order: third_customer_order, actor_user: both_user).call

      expect(customer_profile.reload).to be_restricted
      expect(vendor_profile.reload).not_to be_restricted
    end
  end
end
