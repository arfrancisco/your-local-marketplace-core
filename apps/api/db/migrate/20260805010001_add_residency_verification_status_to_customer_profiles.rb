class AddResidencyVerificationStatusToCustomerProfiles < ActiveRecord::Migration[8.1]
  def change
    # Mirrors vendor_profiles.verification_status: a real admin-driven
    # verification workflow (previously there was none — is_resident and
    # willing_to_verify_residency are both self-reported at registration,
    # see Vendors::EligibilityCheck's comment). Defaults to "unverified";
    # Auth::RegisterUser bumps it to "pending" for anyone claiming resident
    # status, so admins have a real review queue.
    add_column :customer_profiles, :residency_verification_status, :string, default: "unverified", null: false
    add_index :customer_profiles, :residency_verification_status
  end
end
