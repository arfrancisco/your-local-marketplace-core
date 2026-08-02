require "rails_helper"

RSpec.describe "Api::V1::Admin::Items", type: :request do
  let(:item) { create(:item) }

  describe "GET /api/v1/admin/items" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/items" }

    it_behaves_like "requires admin basic auth"
  end

  describe "PATCH /api/v1/admin/items/:id" do
    it "updates stock_count and enabled" do
      patch "/api/v1/admin/items/#{item.id}", params: { item: { stock_count: 0, enabled: false } },
                                               headers: admin_auth_headers
      expect(json.dig("item", "stock_count")).to eq(0)
      expect(json.dig("item", "sold_out")).to be(true)
      expect(item.reload.enabled).to be(false)
    end
  end

  describe "DELETE /api/v1/admin/items/:id" do
    it "deletes the item" do
      item_id = item.id
      delete "/api/v1/admin/items/#{item_id}", headers: admin_auth_headers
      expect(response).to have_http_status(:no_content)
      expect(Item.find_by(id: item_id)).to be_nil
    end
  end
end
