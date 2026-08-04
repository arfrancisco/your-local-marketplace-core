require "rails_helper"

RSpec.describe "Api::V1 Conversations", type: :request do
  let(:customer) { create(:user, :customer) }
  let(:vendor_user) { create(:user, :vendor) }
  let(:shop) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile) }
  let(:order) { create(:order, :with_item, customer_profile: customer.customer_profile, shop: shop) }
  let(:conversation) { create(:conversation, order: order) }

  describe "GET /api/v1/orders/:id/conversation" do
    it "returns the message history to the owning customer" do
      create(:message, conversation: conversation, body: "hi")
      get "/api/v1/orders/#{order.id}/conversation", headers: auth_headers(customer)
      expect(response).to have_http_status(:ok)
      expect(json["messages"].size).to eq(1)
    end

    it "403s for an unrelated user" do
      conversation
      other = create(:user, :customer)
      get "/api/v1/orders/#{order.id}/conversation", headers: auth_headers(other)
      expect(response).to have_http_status(:forbidden)
    end

    it "404s when the order has no conversation yet" do
      bare_order = create(:order, customer_profile: customer.customer_profile, shop: shop)
      get "/api/v1/orders/#{bare_order.id}/conversation", headers: auth_headers(customer)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/orders/:id/messages" do
    it "lets the customer post a message" do
      conversation
      post "/api/v1/orders/#{order.id}/messages", params: { body: "When will it be ready?" }, headers: auth_headers(customer)
      expect(response).to have_http_status(:created)
      expect(json.dig("message", "body")).to eq("When will it be ready?")
      expect(json.dig("message", "sender_user_id")).to eq(customer.id)
    end

    it "lets the vendor reply" do
      conversation
      post "/api/v1/orders/#{order.id}/messages", params: { body: "Ready in 10 minutes" }, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:created)
    end

    it "403s for an unrelated user" do
      conversation
      other = create(:user, :customer)
      post "/api/v1/orders/#{order.id}/messages", params: { body: "hi" }, headers: auth_headers(other)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/orders/:id/conversation/mark_read" do
    it "succeeds for a participant and records a ConversationRead cursor at the latest message" do
      message = create(:message, conversation: conversation, sender_user: vendor_user, body: "Ready in 10 minutes")

      post "/api/v1/orders/#{order.id}/conversation/mark_read", headers: auth_headers(customer)
      expect(response).to have_http_status(:no_content)

      read = ConversationRead.find_by(conversation: conversation, user: customer)
      expect(read).to be_present
      expect(read.last_read_message_id).to eq(message.id)
      expect(read.last_read_at).to be_present
    end

    it "updates an existing ConversationRead row on repeat calls" do
      first_message = create(:message, conversation: conversation, sender_user: vendor_user, body: "Accepted")
      post "/api/v1/orders/#{order.id}/conversation/mark_read", headers: auth_headers(customer)

      second_message = create(:message, conversation: conversation, sender_user: vendor_user, body: "Ready!")
      post "/api/v1/orders/#{order.id}/conversation/mark_read", headers: auth_headers(customer)

      expect(response).to have_http_status(:no_content)
      expect(ConversationRead.where(conversation: conversation, user: customer).count).to eq(1)
      read = ConversationRead.find_by(conversation: conversation, user: customer)
      expect(read.last_read_message_id).to eq(second_message.id)
      expect(read.last_read_message_id).not_to eq(first_message.id)
    end

    it "403s for a non-participant" do
      conversation
      other = create(:user, :customer)
      post "/api/v1/orders/#{order.id}/conversation/mark_read", headers: auth_headers(other)
      expect(response).to have_http_status(:forbidden)
    end

    it "does not error when the conversation has zero messages" do
      conversation
      post "/api/v1/orders/#{order.id}/conversation/mark_read", headers: auth_headers(customer)
      expect(response).to have_http_status(:no_content)
      expect(ConversationRead.find_by(conversation: conversation, user: customer).last_read_message_id).to be_nil
    end
  end
end
