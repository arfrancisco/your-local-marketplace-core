require "rails_helper"

RSpec.describe "Api::V1 Auth", type: :request do
  describe "POST /api/v1/auth/register" do
    let(:params) do
      {
        user: {
          email: "new@example.com", password: "sup3rsecret", mobile_number: "+639171234567",
          is_resident: false, terms_accepted: true
        }
      }
    end

    it "creates a user with a customer profile and returns a token" do
      expect { post "/api/v1/auth/register", params: params }
        .to change(User, :count).by(1)
        .and change(CustomerProfile, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(json["token"]).to be_present
      expect(json.dig("user", "email")).to eq("new@example.com")
      expect(ApiToken.authenticate(json["token"])).to be_present

      user = User.find_by(email: "new@example.com")
      expect(user.terms_accepted_at).to be_present
      expect(user.terms_version).to eq(Auth::RegisterUser::CURRENT_TERMS_VERSION)
      expect(user.email_marketing_opt_in).to eq(false)
      expect(user.sms_marketing_opt_in).to eq(false)
    end

    it "rejects registration outright when the honeypot field is filled, alerts, and creates no user" do
      params[:user][:website] = "http://spam-bot.example"
      user_count_before = User.count

      expect { post "/api/v1/auth/register", params: params }
        .to change(ErrorLog, :count).by(1)
        .and have_enqueued_job(ErrorAlertJob)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(User.count).to eq(user_count_before)
      expect(ErrorLog.last.exception_class).to eq("Api::V1::RegistrationsController::HoneypotTriggered")
    end

    it "rejects registration when the honeypot field is only whitespace, not just when it has real content" do
      # A bot padding its autofill value with a single space would defeat a
      # naive `.present?` check (ActiveSupport treats " " as blank) -- proves
      # the actual check (!= "") catches this specific case, not just an
      # obviously-non-empty value like the other honeypot test uses.
      params[:user][:website] = " "

      expect { post "/api/v1/auth/register", params: params }.not_to change(User, :count)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "does not re-alert on a second honeypot hit, only bumps occurrences_count" do
      params[:user][:website] = "http://spam-bot.example"
      post "/api/v1/auth/register", params: params # first occurrence -- alerts once

      params[:user][:email] = "another-bot@example.com"
      expect { post "/api/v1/auth/register", params: params }.to change(ErrorLog, :count).by(0)

      expect(ErrorLog.last.occurrences_count).to eq(2)
      expect(enqueued_jobs.count { |j| j["job_class"] == "ErrorAlertJob" }).to eq(1)
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

    it "returns a distinct email_taken error on a duplicate email" do
      post "/api/v1/auth/register", params: params
      post "/api/v1/auth/register", params: params
      expect(response).to have_http_status(:conflict)
      expect(json.dig("error", "code")).to eq("email_taken")
    end

    it "requires a mobile number" do
      params[:user].delete(:mobile_number)
      post "/api/v1/auth/register", params: params
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "details")).to have_key("mobile_number")
    end

    it "requires terms acceptance" do
      params[:user][:terms_accepted] = false
      post "/api/v1/auth/register", params: params
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "details")).to have_key("terms_accepted")
    end

    it "requires an is_resident answer" do
      params[:user].delete(:is_resident)
      post "/api/v1/auth/register", params: params
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "details")).to have_key("is_resident")
    end

    it "requires willing_to_verify_residency to be true when is_resident is true" do
      params[:user][:is_resident] = true
      post "/api/v1/auth/register", params: params
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "details")).to have_key("willing_to_verify_residency")
    end

    it "ignores willing_to_verify_residency when is_resident is false" do
      params[:user][:is_resident] = false
      post "/api/v1/auth/register", params: params
      expect(response).to have_http_status(:created)
      user = User.find_by(email: "new@example.com")
      expect(user.customer_profile.is_resident).to eq(false)
      expect(user.customer_profile.willing_to_verify_residency).to be_nil
      expect(user.customer_profile.residency_verification_status).to eq("unverified")
    end

    it "accepts a resident who agrees to verification willingness" do
      params[:user][:is_resident] = true
      params[:user][:willing_to_verify_residency] = true
      post "/api/v1/auth/register", params: params
      expect(response).to have_http_status(:created)
      user = User.find_by(email: "new@example.com")
      expect(user.customer_profile.is_resident).to eq(true)
      expect(user.customer_profile.willing_to_verify_residency).to eq(true)
      # Not "verified" — claiming residency at signup only queues it for
      # admin review (Api::V1::Admin::CustomerProfilesController#verify_residency).
      expect(user.customer_profile.residency_verification_status).to eq("pending")
    end

    it "issues a mobile verification challenge on registration" do
      expect {
        post "/api/v1/auth/register", params: params
      }.to have_enqueued_job(VerificationDeliveryJob)

      user = User.find_by(email: "new@example.com")
      expect(user.verification_challenges.where(purpose: "mobile_verification")).to be_present
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
