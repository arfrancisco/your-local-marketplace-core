require "rails_helper"

RSpec.describe Messaging::PostMessage do
  let(:conversation) { create(:conversation) }
  let(:customer_user) { conversation.order.customer_profile.user }

  it "creates a text message from a real sender" do
    message = described_class.new(conversation: conversation, sender_user: customer_user, body: "Hi!").call
    expect(message).to be_persisted
    expect(message.message_type).to eq("text")
    expect(message.sender_user).to eq(customer_user)
  end

  it "creates a sender-less system message" do
    message = described_class.new(conversation: conversation, message_type: "system", body: "Pay via GCash").call
    expect(message.sender_user).to be_nil
    expect(message.message_type).to eq("system")
  end

  it "broadcasts the serialized message to the conversation's stream" do
    expect(OrderChatChannel).to receive(:broadcast_to).with(conversation, hash_including(body: "Hi!"))
    described_class.new(conversation: conversation, sender_user: customer_user, body: "Hi!").call
  end

  it "raises when the message has neither body nor image" do
    expect { described_class.new(conversation: conversation, sender_user: customer_user, body: nil).call }
      .to raise_error(ActiveRecord::RecordInvalid)
  end
end
