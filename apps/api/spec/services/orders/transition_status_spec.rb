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
    described_class.new(order: order, to_status: "cancelled", actor_user: vendor_user).call
    expect(order.status).to eq("cancelled")
    expect(order.cancelled_at).to be_present
  end

  it "does not allow any transition out of a terminal status" do
    order.update!(status: "completed")
    expect { described_class.new(order: order, to_status: "cancelled", actor_user: vendor_user).call }
      .to raise_error(ApiError::UnprocessableEntity)
  end
end
