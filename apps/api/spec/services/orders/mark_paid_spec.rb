require "rails_helper"

RSpec.describe Orders::MarkPaid do
  let(:order) { create(:order, payment_status: "unpaid") }

  it "marks an unpaid order as paid" do
    described_class.new(order: order).call
    expect(order.reload.payment_status).to eq("marked_paid")
  end

  it "is idempotent for an already-paid order" do
    order.update!(payment_status: "marked_paid")
    expect { described_class.new(order: order).call }.not_to raise_error
    expect(order.reload.payment_status).to eq("marked_paid")
  end
end
