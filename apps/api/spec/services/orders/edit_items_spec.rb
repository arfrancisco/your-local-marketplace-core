require "rails_helper"

RSpec.describe Orders::EditItems do
  let(:vendor_user) { create(:user, :vendor) }
  let(:shop) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile) }
  let(:other_shop) { create(:shop, :open) }
  let(:bowl) { create(:item, shop: shop, name: "Adobo Bowl", price_cents: 15_000) }
  let(:sinigang) { create(:item, shop: shop, name: "Pork Sinigang", price_cents: 20_000) }
  let(:order) do
    create(:order, :with_conversation, shop: shop, status: "placed", subtotal_cents: 15_000, total_cents: 15_000)
  end
  let!(:existing_line) do
    create(:order_item, order: order, item: bowl, item_name: bowl.name, unit_price_cents: 15_000, quantity: 1, line_total_cents: 15_000)
  end

  def call(changes)
    described_class.new(order: order, changes: changes, actor_user: vendor_user).call
  end

  %w[ready_for_pickup out_for_delivery completed rejected cancelled].each do |status|
    it "rejects editing an order that is #{status}" do
      order.update!(status: status)
      expect { call([{ item_id: sinigang.id, quantity: 1 }]) }
        .to raise_error(ApiError::UnprocessableEntity, /Cannot edit items/)
    end
  end

  it "rejects adding a disabled item" do
    sinigang.update!(enabled: false)
    expect { call([{ item_id: sinigang.id, quantity: 1 }]) }
      .to raise_error(ApiError::UnprocessableEntity, /no longer available/)
    expect(order.order_items.reload.count).to eq(1)
  end

  it "rejects adding a sold-out item" do
    sinigang.update!(stock_count: 0)
    expect { call([{ item_id: sinigang.id, quantity: 1 }]) }
      .to raise_error(ApiError::UnprocessableEntity, /no longer available/)
  end

  it "rejects an item that doesn't belong to this order's shop" do
    other_item = create(:item, shop: other_shop)
    expect { call([{ item_id: other_item.id, quantity: 1 }]) }
      .to raise_error(ApiError::UnprocessableEntity, /not from this order's shop/)
  end

  it "adds a new item and recomputes totals" do
    call([{ item_id: sinigang.id, quantity: 2 }])

    order.reload
    expect(order.order_items.count).to eq(2)
    added = order.order_items.find_by(item: sinigang)
    expect(added).to have_attributes(quantity: 2, unit_price_cents: 20_000, line_total_cents: 40_000)
    expect(order.subtotal_cents).to eq(15_000 + 40_000)
    expect(order.total_cents).to eq(15_000 + 40_000)
  end

  it "removes an existing line when quantity is 0" do
    call([{ item_id: bowl.id, quantity: 0 }])

    order.reload
    expect(order.order_items).to be_empty
    expect(order.subtotal_cents).to eq(0)
    expect(order.total_cents).to eq(0)
  end

  it "updates the quantity of an existing line" do
    call([{ item_id: bowl.id, quantity: 3 }])

    expect(existing_line.reload).to have_attributes(quantity: 3, line_total_cents: 45_000)
    expect(order.reload.total_cents).to eq(45_000)
  end

  it "silently no-ops when the submitted quantity matches the existing one" do
    call([{ item_id: bowl.id, quantity: 1 }])

    expect(existing_line.reload.quantity).to eq(1)
    expect(order.conversation.messages).to be_empty
  end

  it "posts a system message narrating an add" do
    call([{ item_id: sinigang.id, quantity: 1 }])

    message = order.conversation.messages.last
    expect(message.message_type).to eq("system")
    expect(message.body).to eq("Vendor updated this order: added 1x Pork Sinigang.")
    expect(message.sender_user).to eq(vendor_user)
  end

  it "posts a system message narrating a removal" do
    call([{ item_id: bowl.id, quantity: 0 }])

    expect(order.conversation.messages.last.body).to eq("Vendor updated this order: removed 1x Adobo Bowl.")
  end

  it "posts a system message narrating a quantity update" do
    call([{ item_id: bowl.id, quantity: 3 }])

    expect(order.conversation.messages.last.body).to eq("Vendor updated this order: updated Adobo Bowl to 3x.")
  end

  it "combines add/remove/update into one message" do
    third_item = create(:item, shop: shop, name: "Halo-Halo")
    call([
      { item_id: sinigang.id, quantity: 1 },
      { item_id: bowl.id, quantity: 0 },
      { item_id: third_item.id, quantity: 2 },
    ])

    body = order.conversation.messages.last.body
    expect(body).to eq(
      "Vendor updated this order: added 1x Pork Sinigang, 2x Halo-Halo; removed 1x Adobo Bowl."
    )
  end
end
