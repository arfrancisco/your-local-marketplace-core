require "rails_helper"

RSpec.describe "Api::V1::Admin::Tags", type: :request do
  let(:tag) { create(:tag) }

  describe "GET /api/v1/admin/tags" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/tags" }

    it_behaves_like "requires admin basic auth"
  end

  describe "DELETE /api/v1/admin/tags/:id" do
    it "deletes the tag" do
      tag_id = tag.id
      delete "/api/v1/admin/tags/#{tag_id}", headers: admin_auth_headers
      expect(response).to have_http_status(:no_content)
      expect(Tag.find_by(id: tag_id)).to be_nil
    end
  end
end
