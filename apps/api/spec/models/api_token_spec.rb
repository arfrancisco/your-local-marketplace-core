require "rails_helper"

RSpec.describe ApiToken, type: :model do
  let(:user) { create(:user) }

  describe ".issue! and .authenticate" do
    it "stores only a digest and resolves the raw token back to the record" do
      record, raw = described_class.issue!(user)
      expect(record.token_digest).not_to eq(raw)
      expect(described_class.authenticate(raw)).to eq(record)
    end

    it "returns nil for an unknown or blank token" do
      expect(described_class.authenticate("nope")).to be_nil
      expect(described_class.authenticate(nil)).to be_nil
    end

    it "does not authenticate an expired token" do
      _record, raw = described_class.issue!(user)
      described_class.last.update!(expires_at: 1.second.ago)
      expect(described_class.authenticate(raw)).to be_nil
    end
  end
end
