require "rails_helper"

RSpec.describe "Api::V1::Admin::Orders", type: :request do
  let(:order) { create(:order, :with_conversation, status: "placed") }

  describe "GET /api/v1/admin/orders" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/orders" }

    it_behaves_like "requires admin basic auth"
  end

  describe "POST /api/v1/admin/orders/:id/transitions" do
    it "forces a legal transition, attributing it to the shop's vendor user with an admin-override reason" do
      vendor_user = order.shop.vendor_profile.user

      expect {
        post "/api/v1/admin/orders/#{order.id}/transitions",
             params: { to_status: "accepted", reason: "unblocking a stuck order" },
             headers: admin_auth_headers
      }.to change { order.order_status_events.count }.by(1)

      expect(response).to have_http_status(:ok)
      expect(json.dig("order", "status")).to eq("accepted")

      event = order.order_status_events.last
      expect(event.actor_user).to eq(vendor_user)
      expect(event.reason).to eq("[admin override] unblocking a stuck order")
    end

    it "still enforces the legal-transition state machine" do
      post "/api/v1/admin/orders/#{order.id}/transitions",
           params: { to_status: "completed", reason: "skip ahead" },
           headers: admin_auth_headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(order.reload.status).to eq("placed")
    end
  end
end
