require "rails_helper"

RSpec.describe RatingReminderJob do
  let(:order) { create(:order, :with_conversation, :completed) }

  it "posts a system reminder message when the order is completed and unrated" do
    expect {
      described_class.new.perform(order.id)
    }.to change { order.conversation.messages.count }.by(1)

    message = order.conversation.messages.last
    expect(message.body).to eq(RatingReminderJob::MESSAGE_BODY)
    expect(message.message_type).to eq("system")
    expect(message.sender_user_id).to be_nil
  end

  it "does not post when the order already has a rating" do
    create(:rating, order: order)

    expect {
      described_class.new.perform(order.id)
    }.not_to change { order.conversation.messages.count }
  end

  it "does not post when the order is no longer completed" do
    order.update!(status: "cancelled")

    expect {
      described_class.new.perform(order.id)
    }.not_to change { order.conversation.messages.count }
  end

  it "does not raise when the order no longer exists" do
    expect { described_class.new.perform(999_999) }.not_to raise_error
  end

  it "does not raise when the order has no conversation" do
    conversationless_order = create(:order, :completed)

    expect { described_class.new.perform(conversationless_order.id) }.not_to raise_error
  end
end
