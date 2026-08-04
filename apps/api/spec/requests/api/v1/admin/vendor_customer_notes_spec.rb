require "rails_helper"

RSpec.describe "Api::V1::Admin::VendorCustomerNotes", type: :request do
  describe "GET /api/v1/admin/vendor_customer_notes" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/vendor_customer_notes" }

    it_behaves_like "requires admin auth"

    it "sees notes across multiple vendors, unlike the vendor-facing endpoint" do
      vendor_a = create(:vendor_profile)
      vendor_b = create(:vendor_profile)
      customer = create(:customer_profile)
      VendorCustomerNote.create!(vendor_profile: vendor_a, customer_profile: customer, note: "From vendor A")
      VendorCustomerNote.create!(vendor_profile: vendor_b, customer_profile: customer, note: "From vendor B")

      get "/api/v1/admin/vendor_customer_notes", params: { customer_profile_id: customer.id }, headers: admin_auth_headers
      notes = json["vendor_customer_notes"]
      expect(notes.map { |n| n["note"] }).to contain_exactly("From vendor A", "From vendor B")
      expect(notes.map { |n| n["vendor_profile_id"] }).to contain_exactly(vendor_a.id, vendor_b.id)
    end
  end

  describe "GET /api/v1/admin/vendor_customer_notes/:id" do
    it "shows a single note" do
      note = VendorCustomerNote.create!(vendor_profile: create(:vendor_profile), customer_profile: create(:customer_profile), note: "Careful with this one")
      get "/api/v1/admin/vendor_customer_notes/#{note.id}", headers: admin_auth_headers
      expect(json.dig("vendor_customer_note", "note")).to eq("Careful with this one")
    end
  end
end
