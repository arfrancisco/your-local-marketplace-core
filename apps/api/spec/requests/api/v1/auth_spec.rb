require "rails_helper"

RSpec.describe "Api::V1 Auth", type: :request do
  describe "POST /api/v1/auth/register" do
    let(:params) do
      { user: { email: "new@example.com", password: "sup3rsecret", display_name: "New Neighbor" } }
    end

    it "creates a user with a customer profile and returns a token" do
      expect { post "/api/v1/auth/register", params: params }
        .to change(User, :count).by(1)
        .and change(CustomerProfile, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(json["token"]).to be_present
      expect(json.dig("user", "email")).to eq("new@example.com")
      expect(ApiToken.authenticate(json["token"])).to be_present
    end

    it "can register a vendor as well when roles ask for it" do
      params[:user][:roles] = %w[customer vendor]
      post "/api/v1/auth/register", params: params
      user = User.find_by(email: "new@example.com")
      expect(user.customer_profile).to be_present
      expect(user.vendor_profile).to be_present
    end

    it "returns a validation error envelope on a bad email" do
      params[:user][:email] = "nope"
      post "/api/v1/auth/register", params: params
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "code")).to eq("validation_failed")
      expect(json.dig("error", "details")).to have_key("email")
    end
  end

  describe "POST /api/v1/auth/login" do
    let!(:user) { create(:user, email: "log@example.com", password: "sup3rsecret") }

    it "issues a token for correct credentials" do
      post "/api/v1/auth/login", params: { email: "log@example.com", password: "sup3rsecret" }
      expect(response).to have_http_status(:created)
      expect(json["token"]).to be_present
      expect(user.reload.last_signed_in_at).to be_present
    end

    it "rejects a wrong password with a generic 401" do
      post "/api/v1/auth/login", params: { email: "log@example.com", password: "wrong" }
      expect(response).to have_http_status(:unauthorized)
      expect(json.dig("error", "message")).to eq("Invalid email or password")
    end

    it "gives the same generic message for an unknown email (no enumeration)" do
      post "/api/v1/auth/login", params: { email: "ghost@example.com", password: "whatever" }
      expect(response).to have_http_status(:unauthorized)
      expect(json.dig("error", "message")).to eq("Invalid email or password")
    end

    it "forbids a suspended account" do
      user.update!(status: "suspended")
      post "/api/v1/auth/login", params: { email: "log@example.com", password: "sup3rsecret" }
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/auth/logout" do
    let(:user) { create(:user) }

    it "revokes the presented token" do
      _record, raw = ApiToken.issue!(user)
      post "/api/v1/auth/logout", headers: { "Authorization" => "Bearer #{raw}" }
      expect(response).to have_http_status(:no_content)
      expect(ApiToken.authenticate(raw)).to be_nil
    end
  end

  describe "authentication guard" do
    it "rejects a protected endpoint without a token" do
      get "/api/v1/me"
      expect(response).to have_http_status(:unauthorized)
      expect(json.dig("error", "code")).to eq("unauthorized")
    end
  end
end
