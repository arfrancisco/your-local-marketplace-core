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

  it "rejects out_for_delivery on a pickup order, even though it's reachable from 'preparing' in the abstract state graph" do
    pickup_order = create(:order, :with_conversation, shop: shop, status: "preparing", fulfillment_method: "pickup")

    expect { described_class.new(order: pickup_order, to_status: "out_for_delivery", actor_user: vendor_user).call }
      .to raise_error(ApiError::UnprocessableEntity, /preparing to out_for_delivery/)
    expect(pickup_order.reload.status).to eq("preparing")
  end

  it "rejects ready_for_pickup on a delivery order" do
    delivery_order = create(:order, :with_conversation, shop: shop, status: "preparing", fulfillment_method: "delivery")

    expect { described_class.new(order: delivery_order, to_status: "ready_for_pickup", actor_user: vendor_user).call }
      .to raise_error(ApiError::UnprocessableEntity, /preparing to ready_for_pickup/)
    expect(delivery_order.reload.status).to eq("preparing")
  end

  it "enqueues RatingReminderJob with a 24-hour delay when completing an order" do
    ready_order = create(:order, :with_conversation, shop: shop, status: "ready_for_pickup")

    expect {
      described_class.new(order: ready_order, to_status: "completed", actor_user: vendor_user).call
    }.to have_enqueued_job(RatingReminderJob).with(ready_order.id).at(a_value_within(5.seconds).of(24.hours.from_now))
  end

  it "does not enqueue RatingReminderJob on a non-completing transition" do
    expect {
      described_class.new(order: order, to_status: "accepted", actor_user: vendor_user).call
    }.not_to have_enqueued_job(RatingReminderJob)
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

  describe "order-lifecycle SMS notification (OrderNotificationJob)" do
    it "enqueues OrderNotificationJob with the created event row's id when accepting" do
      expect {
        described_class.new(order: order, to_status: "accepted", actor_user: vendor_user).call
      }.to have_enqueued_job(OrderNotificationJob)

      event = order.order_status_events.sole
      expect(OrderNotificationJob).to have_been_enqueued.with(event.id)
    end

    it "enqueues OrderNotificationJob when moving to ready_for_pickup" do
      preparing_order = create(:order, :with_conversation, shop: shop, status: "preparing", fulfillment_method: "pickup")

      expect {
        described_class.new(order: preparing_order, to_status: "ready_for_pickup", actor_user: vendor_user).call
      }.to have_enqueued_job(OrderNotificationJob)

      event = preparing_order.order_status_events.sole
      expect(OrderNotificationJob).to have_been_enqueued.with(event.id)
    end

    it "enqueues OrderNotificationJob when moving to out_for_delivery" do
      preparing_order = create(:order, :with_conversation, shop: shop, status: "preparing", fulfillment_method: "delivery")

      expect {
        described_class.new(order: preparing_order, to_status: "out_for_delivery", actor_user: vendor_user).call
      }.to have_enqueued_job(OrderNotificationJob)

      event = preparing_order.order_status_events.sole
      expect(OrderNotificationJob).to have_been_enqueued.with(event.id)
    end

    it "enqueues OrderNotificationJob when completing an order" do
      ready_order = create(:order, :with_conversation, shop: shop, status: "ready_for_pickup")

      expect {
        described_class.new(order: ready_order, to_status: "completed", actor_user: vendor_user).call
      }.to have_enqueued_job(OrderNotificationJob)

      event = ready_order.order_status_events.sole
      expect(OrderNotificationJob).to have_been_enqueued.with(event.id)
    end

    it "does not enqueue OrderNotificationJob when rejecting" do
      expect {
        described_class.new(order: order, to_status: "rejected", actor_user: vendor_user).call
      }.not_to have_enqueued_job(OrderNotificationJob)
    end

    it "does not enqueue OrderNotificationJob when cancelling" do
      expect {
        described_class.new(order: order, to_status: "cancelled", actor_user: vendor_user, reason_code: "item_unavailable").call
      }.not_to have_enqueued_job(OrderNotificationJob)
    end

    it "does not enqueue OrderNotificationJob when moving to preparing" do
      accepted_order = create(:order, :with_conversation, shop: shop, status: "accepted")

      expect {
        described_class.new(order: accepted_order, to_status: "preparing", actor_user: vendor_user).call
      }.not_to have_enqueued_job(OrderNotificationJob)
    end
  end

  describe "row locking prevents a duplicate transition/notification under concurrent requests" do
    it "calls @order.lock! as part of the transition" do
      expect(order).to receive(:lock!).and_call_original

      described_class.new(order: order, to_status: "accepted", actor_user: vendor_user).call
    end

    it "rejects a second concurrent transition once the first has already committed, instead of double-processing it" do
      # Simulates two web requests each having loaded their own, now-stale,
      # in-memory copy of the order — the real shape of the race this fixes
      # (double-tap "Accept" from two tabs). request_a's call runs to
      # completion (and commits) before request_b's call begins, but
      # request_b's in-memory order object was loaded before that commit and
      # is never reloaded until #call's internal @order.lock!.
      order_seen_by_request_a = Order.find(order.id)
      order_seen_by_request_b = Order.find(order.id)

      described_class.new(order: order_seen_by_request_a, to_status: "accepted", actor_user: vendor_user).call

      expect {
        expect {
          described_class.new(order: order_seen_by_request_b, to_status: "accepted", actor_user: vendor_user).call
        }.to raise_error(ApiError::UnprocessableEntity, /accepted to accepted/)
      }.not_to have_enqueued_job(OrderNotificationJob)

      expect(order.reload.status).to eq("accepted")
      expect(order.order_status_events.count).to eq(1)
    end
  end

  describe "cancellation-abuse detection" do
    it "runs Orders::CancellationAbuseCheck when the transition is a cancellation" do
      expect(Orders::CancellationAbuseCheck).to receive(:new)
        .with(order: order, actor_user: vendor_user).and_call_original

      described_class.new(
        order: order, to_status: "cancelled", actor_user: vendor_user, reason_code: "item_unavailable"
      ).call
    end

    it "does not run the abuse check on a non-cancelling transition" do
      expect(Orders::CancellationAbuseCheck).not_to receive(:new)

      described_class.new(order: order, to_status: "accepted", actor_user: vendor_user).call
    end
  end
end
