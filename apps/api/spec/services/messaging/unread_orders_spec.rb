require "rails_helper"

RSpec.describe Messaging::UnreadOrders do
  let(:customer_user) { create(:user, :customer) }
  let(:vendor_user) { create(:user, :vendor) }
  let(:shop) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile) }
  let(:order) { create(:order, :with_conversation, customer_profile: customer_user.customer_profile, shop: shop) }

  def unread_for(user, orders: [order])
    described_class.for(orders: orders, user: user)
  end

  it "flags an order unread when there's a message from the other party and no read cursor yet" do
    create(:message, conversation: order.conversation, sender_user: vendor_user, body: "Accepted!")
    expect(unread_for(customer_user)).to include(order.id)
  end

  it "does not flag an order unread when the only message is from the user themselves" do
    create(:message, conversation: order.conversation, sender_user: customer_user, body: "Hi there")
    expect(unread_for(customer_user)).not_to include(order.id)
  end

  it "does not flag an order unread when the read cursor is at the latest message" do
    message = create(:message, conversation: order.conversation, sender_user: vendor_user, body: "Accepted!")
    create(:conversation_read, conversation: order.conversation, user: customer_user, last_read_message_id: message.id)
    expect(unread_for(customer_user)).not_to include(order.id)
  end

  it "flags an order unread when the read cursor is behind the latest other-party message" do
    first = create(:message, conversation: order.conversation, sender_user: vendor_user, body: "Accepted!")
    create(:conversation_read, conversation: order.conversation, user: customer_user, last_read_message_id: first.id)
    create(:message, conversation: order.conversation, sender_user: vendor_user, body: "It's ready!")
    expect(unread_for(customer_user)).to include(order.id)
  end

  it "never flags an order with no conversation" do
    bare_order = create(:order, customer_profile: customer_user.customer_profile, shop: shop)
    expect { unread_for(customer_user, orders: [bare_order]) }.not_to raise_error
    expect(unread_for(customer_user, orders: [bare_order])).to be_empty
  end

  it "returns an empty set for an empty orders list" do
    expect(described_class.for(orders: [], user: customer_user)).to eq(Set.new)
  end

  it "returns an empty set when user is nil" do
    create(:message, conversation: order.conversation, sender_user: vendor_user, body: "Accepted!")
    expect(described_class.for(orders: [order], user: nil)).to eq(Set.new)
  end
end
