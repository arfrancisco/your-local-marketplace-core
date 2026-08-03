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
    DEFAULT_IMAGE_WIDTH = 1920
    DEFAULT_IMAGE_HEIGHT = 1280

    # Facebook's recommended Open Graph image size — a landscape-ish shape is
    # also what decides whether it renders the big hero-image card at all vs.
    # a small side thumbnail. resize_to_fill crops to exactly this box (like
    # CSS object-fit: cover) so every shop gets the same well-framed shape
    # regardless of its cover photo's native one — real vendor uploads are
    # cropped to a 3:1 banner client-side (ShopFormPage.tsx) which would
    # already satisfy this, but nothing server-side enforces that today.
    OG_IMAGE_WIDTH = 1200
    OG_IMAGE_HEIGHT = 630

    def initialize(shop:, base_url:)
      @shop = shop
      @base_url = base_url
    end

    def call
      image = build_image
      {
        title: "#{@shop.name} — #{SITE_NAME}",
        description: @shop.description.presence || DEFAULT_DESCRIPTION,
        image_url: "#{@base_url}#{image[:path]}",
        image_width: image[:width],
        image_height: image[:height],
        canonical_url: "#{@base_url}/shops/#{@shop.slug}"
      }
    end

    private

    def build_image
      photo = if @shop.cover_photo.attached?
                @shop.cover_photo.first
              elsif @shop.profile_photo.attached?
                @shop.profile_photo.first
              end
      return { path: DEFAULT_IMAGE_PATH, width: DEFAULT_IMAGE_WIDTH, height: DEFAULT_IMAGE_HEIGHT } unless photo

      variant = photo.variant(resize_to_fill: [OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT])
      { path: rails_representation_path(variant, only_path: true), width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }
    end

    # Required by the url helpers even when every call passes only_path: true.
    def default_url_options
      {}
    end
  end
end
