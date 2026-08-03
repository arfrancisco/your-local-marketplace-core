module SocialPreviews
  # Builds the title/description/image/canonical-URL a crawler should see for
  # a shop's page — the shop's own content when it has it, the same site-wide
  # fallbacks baked into index.html when it doesn't (no shop should ever
  # unfurl worse than the plain landing page would).
  class BuildShopMeta
    include Rails.application.routes.url_helpers

    SITE_NAME = "Prisma KapitMarket".freeze
    DEFAULT_DESCRIPTION = "Order food and goods from your neighbors — pickup or delivery, " \
                          "all within your own building cluster.".freeze
    DEFAULT_IMAGE_PATH = "/bazaar.jpg".freeze

    def initialize(shop:, base_url:)
      @shop = shop
      @base_url = base_url
    end

    def call
      {
        title: "#{@shop.name} — #{SITE_NAME}",
        description: @shop.description.presence || DEFAULT_DESCRIPTION,
        image_url: "#{@base_url}#{image_path}",
        canonical_url: "#{@base_url}/shops/#{@shop.slug}"
      }
    end

    private

    def image_path
      photo = if @shop.cover_photo.attached?
                @shop.cover_photo.first
              elsif @shop.profile_photo.attached?
                @shop.profile_photo.first
              end
      return DEFAULT_IMAGE_PATH unless photo

      rails_blob_path(photo, only_path: true)
    end

    # Required by the url helpers even when every call passes only_path: true.
    def default_url_options
      {}
    end
  end
end
