require "rails_helper"

RSpec.describe "Api::V1::Admin::OrderStatusEvents", type: :request do
  let(:order) { create(:order, :with_conversation, status: "placed") }

  before do
    Orders::TransitionStatus.new(order: order, to_status: "accepted", actor_user: order.shop.vendor_profile.user).call
  end

  describe "GET /api/v1/admin/order_status_events" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/order_status_events" }

    it_behaves_like "requires admin auth"

    it "filters by order_id" do
      other_order = create(:order, :with_conversation, status: "placed")
      Orders::TransitionStatus.new(order: other_order, to_status: "accepted", actor_user: other_order.shop.vendor_profile.user).call

      get "/api/v1/admin/order_status_events", params: { order_id: order.id }, headers: admin_auth_headers
      expect(json["order_status_events"].size).to eq(1)
      expect(json["order_status_events"].first["order_id"]).to eq(order.id)
    end
  end
end
