require "rails_helper"

RSpec.describe "Api::V1::Admin::Conversations", type: :request do
  let(:conversation) { create(:conversation) }

  describe "GET /api/v1/admin/conversations/:id" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/conversations/#{conversation.id}" }

    it_behaves_like "requires admin basic auth"

    it "returns the full transcript" do
      create(:message, conversation: conversation, body: "When will it be ready?")
      get "/api/v1/admin/conversations/#{conversation.id}", headers: admin_auth_headers
      expect(json.dig("conversation", "messages").map { |m| m["body"] }).to include("When will it be ready?")
    end
  end
end
