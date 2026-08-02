require "rails_helper"

RSpec.describe "Api::V1::Vendor CustomerNotes", type: :request do
  let(:vendor_user)     { create(:user, :vendor) }
  let(:vendor_profile)  { vendor_user.vendor_profile }
  let(:shop)            { create(:shop, vendor_profile: vendor_profile) }
  let(:customer)        { create(:customer_profile) }
  let(:order)           { create(:order, shop: shop, customer_profile: customer) }

  describe "POST /api/v1/vendor/customer_notes" do
    it "records a private note about the customer on one of the vendor's orders" do
      expect {
        post "/api/v1/vendor/customer_notes",
             params: { order_id: order.id, note: "No-showed for pickup.", flagged: true },
             headers: auth_headers(vendor_user)
      }.to change(VendorCustomerNote, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(json.dig("customer_note", "note")).to eq("No-showed for pickup.")
      expect(json.dig("customer_note", "flagged")).to be(true)
      expect(json.dig("customer_note", "customer_profile_id")).to eq(customer.id)
      expect(json.dig("customer_note", "order_id")).to eq(order.id)
    end

    it "derives the customer from the order rather than trusting a param" do
      someone_else = create(:customer_profile)
      post "/api/v1/vendor/customer_notes",
           params: { order_id: order.id, note: "Note", customer_profile_id: someone_else.id },
           headers: auth_headers(vendor_user)

      expect(response).to have_http_status(:created)
      expect(VendorCustomerNote.last.customer_profile_id).to eq(customer.id)
    end

    it "defaults flagged to false when omitted" do
      post "/api/v1/vendor/customer_notes",
           params: { order_id: order.id, note: "Just a note." },
           headers: auth_headers(vendor_user)

      expect(json.dig("customer_note", "flagged")).to be(false)
    end

    it "rejects a blank note" do
      post "/api/v1/vendor/customer_notes",
           params: { order_id: order.id, note: "" },
           headers: auth_headers(vendor_user)

      expect(response).to have_http_status(:bad_request)
    end

    it "404s when the order belongs to another vendor" do
      others_order = create(:order)
      expect {
        post "/api/v1/vendor/customer_notes",
             params: { order_id: others_order.id, note: "Note" },
             headers: auth_headers(vendor_user)
      }.not_to change(VendorCustomerNote, :count)

      expect(response).to have_http_status(:not_found)
    end

    it "requires authentication" do
      post "/api/v1/vendor/customer_notes", params: { order_id: order.id, note: "Note" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "forbids a user without a vendor profile" do
      customer_user = create(:user, :customer)
      post "/api/v1/vendor/customer_notes",
           params: { order_id: order.id, note: "Note" },
           headers: auth_headers(customer_user)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/vendor/customer_notes" do
    let!(:note) { create(:vendor_customer_note, vendor_profile: vendor_profile, customer_profile: customer, order: order) }

    it "lists the vendor's own notes" do
      get "/api/v1/vendor/customer_notes", headers: auth_headers(vendor_user)

      expect(response).to have_http_status(:ok)
      expect(json["customer_notes"].map { |n| n["id"] }).to eq([note.id])
    end

    it "filters by customer_profile_id" do
      other_customer = create(:customer_profile)
      create(:vendor_customer_note, vendor_profile: vendor_profile, customer_profile: other_customer)

      get "/api/v1/vendor/customer_notes",
          params: { customer_profile_id: customer.id },
          headers: auth_headers(vendor_user)

      expect(json["customer_notes"].map { |n| n["id"] }).to eq([note.id])
    end

    it "does not leak the authoring vendor id in the payload" do
      get "/api/v1/vendor/customer_notes", headers: auth_headers(vendor_user)
      expect(json["customer_notes"].first).not_to have_key("vendor_profile_id")
    end
  end

  describe "PATCH /api/v1/vendor/customer_notes/:id" do
    let!(:note) { create(:vendor_customer_note, vendor_profile: vendor_profile, customer_profile: customer, order: order) }

    it "updates the note body and flag" do
      patch "/api/v1/vendor/customer_notes/#{note.id}",
            params: { note: "Updated.", flagged: true },
            headers: auth_headers(vendor_user)

      expect(response).to have_http_status(:ok)
      expect(note.reload.note).to eq("Updated.")
      expect(note.flagged).to be(true)
    end

    it "404s when editing another vendor's note" do
      others_note = create(:vendor_customer_note, customer_profile: customer)
      patch "/api/v1/vendor/customer_notes/#{others_note.id}",
            params: { note: "Tampered." },
            headers: auth_headers(vendor_user)

      expect(response).to have_http_status(:not_found)
      expect(others_note.reload.note).not_to eq("Tampered.")
    end
  end

  describe "DELETE /api/v1/vendor/customer_notes/:id" do
    let!(:note) { create(:vendor_customer_note, vendor_profile: vendor_profile, customer_profile: customer, order: order) }

    it "deletes the vendor's own note" do
      expect {
        delete "/api/v1/vendor/customer_notes/#{note.id}", headers: auth_headers(vendor_user)
      }.to change(VendorCustomerNote, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end

    it "404s when deleting another vendor's note" do
      others_note = create(:vendor_customer_note, customer_profile: customer)
      expect {
        delete "/api/v1/vendor/customer_notes/#{others_note.id}", headers: auth_headers(vendor_user)
      }.not_to change(VendorCustomerNote, :count)

      expect(response).to have_http_status(:not_found)
    end
  end

  # The load-bearing test for this whole feature. Two vendors independently
  # serve the SAME customer. Vendor A's private note about that customer must
  # be invisible to vendor B through every read path, even though vendor B has
  # a legitimate order with that same customer and could plausibly be thought
  # to "share" a view of them. If this ever goes red, the feature's core
  # privacy promise is broken.
  describe "cross-vendor isolation" do
    let(:vendor_a_user) { create(:user, :vendor) }
    let(:vendor_b_user) { create(:user, :vendor) }
    let(:shared_customer) { create(:customer_profile) }

    let(:shop_a) { create(:shop, vendor_profile: vendor_a_user.vendor_profile) }
    let(:shop_b) { create(:shop, vendor_profile: vendor_b_user.vendor_profile) }

    let!(:order_a) { create(:order, shop: shop_a, customer_profile: shared_customer) }
    let!(:order_b) { create(:order, shop: shop_b, customer_profile: shared_customer) }

    let!(:note_by_a) do
      create(:vendor_customer_note, :flagged,
             vendor_profile: vendor_a_user.vendor_profile,
             customer_profile: shared_customer,
             order: order_a,
             note: "Suspected scam attempt.")
    end

    it "hides vendor A's note from vendor B's unfiltered index" do
      get "/api/v1/vendor/customer_notes", headers: auth_headers(vendor_b_user)

      expect(response).to have_http_status(:ok)
      expect(json["customer_notes"]).to be_empty
    end

    it "hides vendor A's note from vendor B even when filtering by the shared customer" do
      get "/api/v1/vendor/customer_notes",
          params: { customer_profile_id: shared_customer.id },
          headers: auth_headers(vendor_b_user)

      expect(response).to have_http_status(:ok)
      expect(json["customer_notes"]).to be_empty
      expect(response.body).not_to include("Suspected scam attempt")
    end

    it "does not let vendor B reach vendor A's note by id" do
      patch "/api/v1/vendor/customer_notes/#{note_by_a.id}",
            params: { note: "Tampered." },
            headers: auth_headers(vendor_b_user)
      expect(response).to have_http_status(:not_found)

      delete "/api/v1/vendor/customer_notes/#{note_by_a.id}", headers: auth_headers(vendor_b_user)
      expect(response).to have_http_status(:not_found)

      expect(note_by_a.reload.note).to eq("Suspected scam attempt.")
    end

    it "still shows vendor A their own note about the shared customer" do
      get "/api/v1/vendor/customer_notes",
          params: { customer_profile_id: shared_customer.id },
          headers: auth_headers(vendor_a_user)

      expect(json["customer_notes"].map { |n| n["id"] }).to eq([note_by_a.id])
    end

    it "keeps vendor B's own note about the same customer separate" do
      post "/api/v1/vendor/customer_notes",
           params: { order_id: order_b.id, note: "Polite, paid on time." },
           headers: auth_headers(vendor_b_user)
      expect(response).to have_http_status(:created)

      get "/api/v1/vendor/customer_notes", headers: auth_headers(vendor_b_user)
      notes = json["customer_notes"]
      expect(notes.length).to eq(1)
      expect(notes.first["note"]).to eq("Polite, paid on time.")
    end
  end
end
