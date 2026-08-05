require "rails_helper"

RSpec.describe "Api::V1::Vendor Shops", type: :request do
  let(:vendor_user) { create(:user, :vendor) }
  let(:vendor_profile) { vendor_user.vendor_profile }

  let(:valid_params) do
    { shop: { name: "Corner Kitchen", description: "Home food", building: "Astra",
              address: "Unit 12F", contact_number: "+639170001234",
              fulfillment_methods: %w[pickup delivery] } }
  end

  describe "POST /api/v1/vendor/shops" do
    it "creates a shop owned by the vendor" do
      expect {
        post "/api/v1/vendor/shops", params: valid_params, headers: auth_headers(vendor_user)
      }.to change(Shop, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(json.dig("shop", "slug")).to eq("corner-kitchen")
      expect(Shop.last.vendor_profile).to eq(vendor_profile)
    end

    it "returns both the public building and the private exact-unit address to the vendor themselves" do
      post "/api/v1/vendor/shops", params: valid_params, headers: auth_headers(vendor_user)

      expect(json.dig("shop", "building")).to eq("Astra")
      expect(json.dig("shop", "address")).to eq("Unit 12F")
    end

    it "rejects a shop with no fulfillment method" do
      valid_params[:shop][:fulfillment_methods] = []
      post "/api/v1/vendor/shops", params: valid_params, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "code")).to eq("validation_failed")
    end

    it "forbids a user without a vendor profile" do
      customer = create(:user, :customer)
      post "/api/v1/vendor/shops", params: valid_params, headers: auth_headers(customer)
      expect(response).to have_http_status(:forbidden)
    end

    it "requires authentication" do
      post "/api/v1/vendor/shops", params: valid_params
      expect(response).to have_http_status(:unauthorized)
    end

    it "attaches an uploaded profile picture and cover photo" do
      valid_params[:shop][:profile_photo] = fixture_file_upload("sample.png", "image/png")
      valid_params[:shop][:cover_photo] = fixture_file_upload("sample.png", "image/png")
      post "/api/v1/vendor/shops", params: valid_params, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:created)
      expect(json.dig("shop", "profile_photo")).to be_present
      expect(json.dig("shop", "cover_photo")).to be_present
    end

    it "rejects an upload of a disallowed type" do
      valid_params[:shop][:profile_photo] = fixture_file_upload("note.txt", "text/plain")
      post "/api/v1/vendor/shops", params: valid_params, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "ownership isolation" do
    it "404s when accessing another vendor's shop" do
      others_shop = create(:shop)
      get "/api/v1/vendor/shops/#{others_shop.id}", headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "open/close" do
    let!(:shop) { create(:shop, vendor_profile: vendor_profile) }

    it "opens a shop" do
      post "/api/v1/vendor/shops/#{shop.id}/open", headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:ok)
      expect(json.dig("shop", "open")).to be(true)
    end

    it "closes a shop" do
      shop.open!
      post "/api/v1/vendor/shops/#{shop.id}/close", headers: auth_headers(vendor_user)
      expect(json.dig("shop", "open")).to be(false)
    end
  end

  describe "GET /api/v1/vendor/shops" do
    it "lists only the current vendor's shops" do
      create(:shop, vendor_profile: vendor_profile)
      create(:shop) # another vendor
      get "/api/v1/vendor/shops", headers: auth_headers(vendor_user)
      expect(json["shops"].size).to eq(1)
    end
  end
end
