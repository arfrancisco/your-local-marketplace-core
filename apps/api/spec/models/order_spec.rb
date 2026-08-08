require "rails_helper"

RSpec.describe Order do
  describe "#available_transitions / #can_transition_to?" do
    it "only offers ready_for_pickup, not out_for_delivery, on a pickup order in preparing" do
      order = create(:order, status: "preparing", fulfillment_method: "pickup")

      expect(order.available_transitions).to eq(%w[ready_for_pickup])
      expect(order.can_transition_to?("ready_for_pickup")).to eq(true)
      expect(order.can_transition_to?("out_for_delivery")).to eq(false)
    end

    it "only offers out_for_delivery, not ready_for_pickup, on a delivery order in preparing" do
      order = create(:order, status: "preparing", fulfillment_method: "delivery")

      expect(order.available_transitions).to eq(%w[out_for_delivery])
      expect(order.can_transition_to?("out_for_delivery")).to eq(true)
      expect(order.can_transition_to?("ready_for_pickup")).to eq(false)
    end

    it "leaves transitions with no fulfillment-specific meaning untouched" do
      order = create(:order, status: "placed", fulfillment_method: "delivery")
      expect(order.available_transitions).to eq(%w[accepted rejected cancelled])
    end
  end
end
