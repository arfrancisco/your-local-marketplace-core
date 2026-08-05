require "rails_helper"

RSpec.describe "Api::V1 Me", type: :request do
  let(:user) { create(:user, :customer, :verified) }

  describe "GET /api/v1/me" do
    it "returns the current user's profile" do
      get "/api/v1/me", headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      expect(json.dig("user", "id")).to eq(user.id)
      expect(json.dig("user", "customer_profile")).to be_present
      expect(json["user"]).not_to have_key("password_digest")
    end
  end

  describe "PATCH /api/v1/me" do
    it "updates the display name across profiles" do
      patch "/api/v1/me", params: { user: { display_name: "Renamed" } }, headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      expect(user.customer_profile.reload.display_name).to eq("Renamed")
    end

    it "clears email verification when the email changes" do
      patch "/api/v1/me", params: { user: { email: "changed@example.com" } }, headers: auth_headers(user)
      expect(user.reload.email).to eq("changed@example.com")
      expect(user).not_to be_email_verified
    end
  end

  describe "POST /api/v1/me/complete_profile" do
    let(:valid_params) do
      {
        first_name: "Juan", last_name: "Dela Cruz",
        address: { building: "Astra", unit: "12F", delivery_instructions: "Leave with the guard" }
      }
    end

    it "sets the user's name, creates an address, and sets it as default" do
      expect {
        post "/api/v1/me/complete_profile", params: valid_params, headers: auth_headers(user)
      }.to change(user.addresses, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(user.reload.first_name).to eq("Juan")
      expect(user.last_name).to eq("Dela Cruz")
      expect(user.customer_profile.reload.display_name).to eq("Juan Dela Cruz")
      address = user.addresses.last
      expect(user.customer_profile.default_address_id).to eq(address.id)
      expect(address.recipient_name).to eq("Juan Dela Cruz")
      expect(address.mobile_number).to eq(user.mobile_number)
    end

    it "passes through the optional street address and city" do
      post "/api/v1/me/complete_profile",
           params: valid_params.deep_merge(address: { street_address: "123 Rizal St.", city: "Pasig City" }),
           headers: auth_headers(user)
      expect(response).to have_http_status(:created)
      address = user.addresses.last
      expect(address.street_address).to eq("123 Rizal St.")
      expect(address.city).to eq("Pasig City")
    end

    it "requires first and last name" do
      post "/api/v1/me/complete_profile",
           params: valid_params.merge(first_name: ""), headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "details")).to have_key("first_name")
    end

    it "requires a unit when the customer has claimed residency" do
      user.customer_profile.update!(is_resident: true, willing_to_verify_residency: true)
      post "/api/v1/me/complete_profile",
           params: valid_params.merge(address: valid_params[:address].merge(unit: "")),
           headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "details")).to have_key("unit")
    end
  end
end
