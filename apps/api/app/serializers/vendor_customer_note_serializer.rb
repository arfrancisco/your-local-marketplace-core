# Vendor-facing shape for a private customer note.
#
# Intentionally omits vendor_profile_id: this serializer is only ever reached
# through a scope already filtered to the current vendor, so the author is
# always "me". Leaving it out keeps the payload from implying these are
# comparable across vendors.
module VendorCustomerNoteSerializer
  module_function

  def call(note)
    {
      id: note.id,
      customer_profile_id: note.customer_profile_id,
      order_id: note.order_id,
      note: note.note,
      flagged: note.flagged,
      created_at: note.created_at,
      updated_at: note.updated_at
    }
  end
end
