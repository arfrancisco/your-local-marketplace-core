module SocialPreviews
  # Social platforms unfurl a shared link by fetching it once with a bot user
  # agent that (almost) never executes JavaScript — this app is a client-
  # rendered SPA, so those requests would otherwise only ever see the same
  # generic <head> regardless of which shop was shared. Recognizing these
  # user agents is what lets StaticController serve a shop-specific, server-
  # rendered set of Open Graph tags just for them, while real visitors still
  # get the normal SPA untouched.
  module DetectCrawler
    # Not exhaustive by design — covers the major platforms this app's users
    # actually share links on, not a generic bot/SEO-crawler list.
    # %r{} rather than a slash-delimited literal: a literal slash anywhere in
    # here — even inside an /x-mode comment — closes a /.../ literal early,
    # which a stray "DM/story" in an earlier draft of these comments proved.
    USER_AGENT_PATTERN = %r{
      facebookexternalhit | Facebot   # Facebook + Messenger (also covers Instagram unfurls — same crawler infra)
      | Twitterbot                    # X (Twitter)
      | LinkedInBot                   # LinkedIn
      | WhatsApp                      # WhatsApp link preview
      | TelegramBot                   # Telegram
      | Discordbot                    # Discord
      | Slackbot | Slack-ImgProxy     # Slack unfurling
      | Pinterest                     # Pinterest
      | redditbot                     # Reddit
      | SkypeUriPreview               # Skype
      | vkShare                       # VK
    }xi

    def self.bot?(user_agent)
      user_agent.present? && user_agent.match?(USER_AGENT_PATTERN)
    end
  end
end
