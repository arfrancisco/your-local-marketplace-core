require "rails_helper"

RSpec.describe AdminApiToken, type: :model do
  let(:admin_user) { create(:admin_user) }

  describe ".issue! and .authenticate" do
    it "stores only a digest and resolves the raw token back to the record" do
      record, raw = described_class.issue!(admin_user)
      expect(record.token_digest).not_to eq(raw)
      expect(described_class.authenticate(raw)).to eq(record)
    end

    it "returns nil for an unknown or blank token" do
      expect(described_class.authenticate("nope")).to be_nil
      expect(described_class.authenticate(nil)).to be_nil
    end

    it "does not authenticate an expired token" do
      _record, raw = described_class.issue!(admin_user)
      described_class.last.update!(expires_at: 1.second.ago)
      expect(described_class.authenticate(raw)).to be_nil
    end

    it "accepts a ttl: override for a longer-lived token (admin-mcp)" do
      record, = described_class.issue!(admin_user, ttl: 180.days)
      expect(record.expires_at).to be_within(1.minute).of(180.days.from_now)
    end
  end
end
