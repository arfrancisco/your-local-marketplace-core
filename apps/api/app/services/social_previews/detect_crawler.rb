module SocialPreviews
  # Social platforms unfurl a shared link by fetching it once with a bot user
  # agent that (almost) never executes JavaScript — this app is a client-
  # rendered SPA, so those requests would otherwise only ever see the same
  # generic <head> regardless of which shop was shared. Recognizing these
  # user agents is what lets StaticController serve a shop-specific, server-
  # rendered set of Open Graph tags just for them, while real visitors still
  # get the normal SPA untouched.
  module DetectCrawler
    # Scope deliberately limited to Facebook + Instagram for now (the
    # platforms this app's users actually share links on) — add more
    # platform-specific user agents here if that need grows.
    # %r{} rather than a slash-delimited literal: a literal slash anywhere in
    # here — even inside an /x-mode comment — closes a /.../ literal early,
    # which a stray "DM/story" in an earlier draft of these comments proved.
    USER_AGENT_PATTERN = %r{
      facebookexternalhit | Facebot   # Facebook + Messenger, and Instagram — same crawler infra, no separate Instagram UA
    }xi

    def self.bot?(user_agent)
      user_agent.present? && user_agent.match?(USER_AGENT_PATTERN)
    end
  end
end
