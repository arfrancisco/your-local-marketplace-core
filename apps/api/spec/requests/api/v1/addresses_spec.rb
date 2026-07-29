require "rails_helper"

RSpec.describe "Api::V1 Addresses", type: :request do
  let(:user) { create(:user, :customer) }

  let(:valid_params) do
    { address: { label: "Home", recipient_name: "Juan Dela Cruz", building: "Tower A", unit: "12F",
                 delivery_instructions: "Leave with the guard" } }
  end

  describe "POST /api/v1/addresses" do
    it "creates an address for the current user" do
      expect {
        post "/api/v1/addresses", params: valid_params, headers: auth_headers(user)
      }.to change(user.addresses, :count).by(1)
      expect(response).to have_http_status(:created)
      expect(json.dig("address", "building")).to eq("Tower A")
    end

    it "rejects an address missing required fields" do
      post "/api/v1/addresses", params: { address: { label: "Home" } }, headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "ownership" do
    it "lists only the current user's addresses" do
      create(:address, user: user, building: "Mine")
      create(:address, building: "Someone else's")
      get "/api/v1/addresses", headers: auth_headers(user)
      expect(json["addresses"].map { |a| a["building"] }).to eq(["Mine"])
    end

    it "404s when updating another user's address" do
      others = create(:address)
      patch "/api/v1/addresses/#{others.id}", params: { address: { label: "x" } }, headers: auth_headers(user)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "default address via PATCH /me" do
    it "sets the customer's default address to one they own" do
      address = create(:address, user: user)
      patch "/api/v1/me", params: { user: { default_address_id: address.id } }, headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      expect(user.customer_profile.reload.default_address_id).to eq(address.id)
    end

    it "will not set a default address owned by someone else" do
      others = create(:address)
      patch "/api/v1/me", params: { user: { default_address_id: others.id } }, headers: auth_headers(user)
      expect(response).to have_http_status(:not_found)
    end
  end
end
