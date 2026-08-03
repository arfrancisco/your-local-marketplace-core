require "rails_helper"

RSpec.describe SocialPreviews::DetectCrawler do
  describe ".bot?" do
    it "recognizes Facebook's crawler (also covers Instagram unfurls — same crawler infra)" do
      expect(described_class.bot?("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).to be true
    end

    it "recognizes Facebook's alternate Facebot user agent" do
      expect(described_class.bot?("Facebot")).to be true
    end

    it "is case-insensitive" do
      expect(described_class.bot?("FACEBOOKEXTERNALHIT/1.1")).to be true
    end

    it "does not flag other platforms' crawlers — scope is Facebook/Instagram only for now" do
      expect(described_class.bot?("Twitterbot/1.0")).to be false
      expect(described_class.bot?("LinkedInBot/1.0")).to be false
      expect(described_class.bot?("Slackbot-LinkExpanding 1.0")).to be false
    end

    it "does not flag an ordinary browser" do
      expect(described_class.bot?("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15")).to be false
    end

    it "does not flag a blank or missing user agent" do
      expect(described_class.bot?(nil)).to be false
      expect(described_class.bot?("")).to be false
    end
  end
end
