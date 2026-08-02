module Admin
  # Admin's cross-vendor view of a private customer note — unlike the
  # vendor-facing VendorCustomerNoteSerializer, this includes
  # vendor_profile_id since an operator needs to know which vendor wrote it
  # (e.g. to cross-reference whether multiple vendors have separately
  # flagged the same customer_profile_id).
  module VendorCustomerNoteSerializer
    module_function

    def call(note)
      {
        id: note.id,
        vendor_profile_id: note.vendor_profile_id,
        customer_profile_id: note.customer_profile_id,
        order_id: note.order_id,
        note: note.note,
        flagged: note.flagged,
        created_at: note.created_at,
        updated_at: note.updated_at
      }
    end
  end
end
