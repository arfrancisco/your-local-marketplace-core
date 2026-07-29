require "rails_helper"

RSpec.describe VerificationChallenge, type: :model do
  let(:user) { create(:user) }

  describe ".issue!" do
    it "stores only a digest and returns the plaintext code once" do
      challenge, code = described_class.issue!(
        user: user, channel: "email", purpose: "email_verification", sent_to: user.email
      )
      expect(code).to match(/\A\d{6}\z/)
      expect(challenge.code_digest).not_to include(code)
      expect(BCrypt::Password.new(challenge.code_digest)).to eq(code)
      expect(challenge.expires_at).to be > Time.current
    end
  end

  describe "#verify" do
    def issue
      described_class.issue!(user: user, channel: "email", purpose: "email_verification", sent_to: user.email)
    end

    it "consumes the challenge on the correct code" do
      challenge, code = issue
      expect(challenge.verify(code)).to be(true)
      expect(challenge.reload).to be_consumed
    end

    it "rejects a wrong code and counts the attempt" do
      challenge, = issue
      expect(challenge.verify("000000")).to be(false)
      expect(challenge.reload.attempts_count).to eq(1)
    end

    it "cannot be reused once consumed" do
      challenge, code = issue
      challenge.verify(code)
      expect(challenge.verify(code)).to be(false)
    end

    it "rejects a correct code after expiry" do
      challenge, code = issue
      challenge.update!(expires_at: 1.second.ago)
      expect(challenge.verify(code)).to be(false)
    end

    it "locks out after too many attempts even with the right code later" do
      challenge, code = issue
      described_class::MAX_ATTEMPTS.times { challenge.verify("000000") }
      expect(challenge.verify(code)).to be(false)
    end
  end
end
