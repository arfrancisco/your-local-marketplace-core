require "rails_helper"

RSpec.describe SocialPreviews::DetectCrawler do
  describe ".bot?" do
    it "recognizes Facebook's crawler (also covers Instagram unfurls)" do
      expect(described_class.bot?("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).to be true
    end

    it "recognizes Twitter/X's crawler" do
      expect(described_class.bot?("Twitterbot/1.0")).to be true
    end

    it "recognizes LinkedIn, Slack, Discord, WhatsApp, and Telegram crawlers" do
      expect(described_class.bot?("LinkedInBot/1.0")).to be true
      expect(described_class.bot?("Slackbot-LinkExpanding 1.0")).to be true
      expect(described_class.bot?("Mozilla/2.0 (compatible; Discordbot/2.0; +https://discordapp.com)")).to be true
      expect(described_class.bot?("WhatsApp/2.23.0")).to be true
      expect(described_class.bot?("TelegramBot (like TwitterBot)")).to be true
    end

    it "is case-insensitive" do
      expect(described_class.bot?("TWITTERBOT/1.0")).to be true
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
