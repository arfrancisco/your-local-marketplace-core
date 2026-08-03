require "rails_helper"

RSpec.describe Orders::TransitionStatus do
  let(:vendor_user) { create(:user, :vendor) }
  let(:shop) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile) }
  let(:order) { create(:order, :with_conversation, shop: shop, status: "placed") }

  it "moves an order along a legal transition and logs an event" do
    described_class.new(order: order, to_status: "accepted", actor_user: vendor_user).call

    expect(order.status).to eq("accepted")
    expect(order.accepted_at).to be_present
    expect(order.order_status_events.sole).to have_attributes(
      from_status: "placed", to_status: "accepted", actor_user: vendor_user
    )
  end

  it "posts exactly one system chat message with the right body" do
    expect {
      described_class.new(order: order, to_status: "accepted", actor_user: vendor_user).call
    }.to change { order.conversation.messages.count }.by(1)

    message = order.conversation.messages.last
    expect(message.message_type).to eq("system")
    expect(message.body).to eq("Order accepted by the vendor.")
    expect(message.sender_user).to eq(vendor_user)
  end

  it "rejects an illegal transition and does not log an event" do
    expect { described_class.new(order: order, to_status: "completed", actor_user: vendor_user).call }
      .to raise_error(ApiError::UnprocessableEntity, /placed to completed/)
    expect(order.reload.status).to eq("placed")
    expect(order.order_status_events).to be_empty
  end

  it "sets cancelled_at when cancelling" do
    described_class.new(order: order, to_status: "cancelled", actor_user: vendor_user, reason_code: "item_unavailable").call
    expect(order.status).to eq("cancelled")
    expect(order.cancelled_at).to be_present
  end

  it "does not allow any transition out of a terminal status" do
    order.update!(status: "completed")
    expect {
      described_class.new(order: order, to_status: "cancelled", actor_user: vendor_user, reason_code: "item_unavailable").call
    }.to raise_error(ApiError::UnprocessableEntity)
  end

  describe "cancellation reasons" do
    let(:customer_user) { order.customer_profile.user }

    it "rejects a cancellation with no reason_code" do
      expect {
        described_class.new(order: order, to_status: "cancelled", actor_user: vendor_user).call
      }.to raise_error(ApiError::UnprocessableEntity, /reason is required/)
      expect(order.reload.status).to eq("placed")
    end

    it "rejects a reason_code that isn't in the acting party's own list" do
      # "item_unavailable" is a vendor reason, not a customer one.
      expect {
        described_class.new(order: order, to_status: "cancelled", actor_user: customer_user, reason_code: "item_unavailable").call
      }.to raise_error(ApiError::UnprocessableEntity, /reason is required/)
    end

    it "rejects reason_code 'other' with no free-text reason" do
      expect {
        described_class.new(order: order, to_status: "cancelled", actor_user: vendor_user, reason_code: "other").call
      }.to raise_error(ApiError::UnprocessableEntity, /describe the reason/)
    end

    it "accepts a valid non-'other' code with no free text, from the vendor" do
      described_class.new(order: order, to_status: "cancelled", actor_user: vendor_user, reason_code: "item_unavailable").call

      expect(order.reload.status).to eq("cancelled")
      event = order.order_status_events.sole
      expect(event.reason_code).to eq("item_unavailable")
      expect(event.reason).to be_nil
    end

    it "accepts a valid non-'other' code with no free text, from the customer" do
      described_class.new(order: order, to_status: "cancelled", actor_user: customer_user, reason_code: "changed_mind").call

      expect(order.reload.status).to eq("cancelled")
      expect(order.order_status_events.sole.reason_code).to eq("changed_mind")
    end

    it "accepts 'other' with a free-text reason and stores both" do
      described_class.new(
        order: order, to_status: "cancelled", actor_user: vendor_user,
        reason_code: "other", reason: "Fridge broke down overnight"
      ).call

      event = order.order_status_events.sole
      expect(event.reason_code).to eq("other")
      expect(event.reason).to eq("Fridge broke down overnight")
    end

    it "includes the reason in the system chat message, by actor" do
      described_class.new(order: order, to_status: "cancelled", actor_user: vendor_user, reason_code: "item_unavailable").call

      message = order.conversation.messages.last
      expect(message.body).to eq("Order cancelled by the vendor: Item(s) no longer available.")
    end

    it "uses the free-text reason verbatim in the system message when reason_code is 'other'" do
      described_class.new(
        order: order, to_status: "cancelled", actor_user: vendor_user,
        reason_code: "other", reason: "Fridge broke down overnight"
      ).call

      message = order.conversation.messages.last
      expect(message.body).to eq("Order cancelled by the vendor: Fridge broke down overnight.")
    end
  end
end
