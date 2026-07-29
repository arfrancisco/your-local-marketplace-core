module AddressSerializer
  module_function

  def call(address)
    {
      id: address.id,
      label: address.label,
      recipient_name: address.recipient_name,
      mobile_number: address.mobile_number,
      unit: address.unit,
      building: address.building,
      notes: address.notes,
      delivery_instructions: address.delivery_instructions,
      created_at: address.created_at
    }
  end
end
