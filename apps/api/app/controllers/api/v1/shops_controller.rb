module Api
  module V1
    # Customer-facing discovery. Only open shops (active + accepting orders) are
    # visible, and only enabled items within them. Requires authentication: this
    # is a closed neighbor community, not a public search index (ADR 0002).
    class ShopsController < BaseController
      # GET /api/v1/shops
      def index
        shops = ShopRotation.order(Shop.listed.includes(:vendor_profile))
        render json: { shops: shops.map { |shop| ShopSerializer.call(shop) } }
      end

      # GET /api/v1/shops/:slug
      def show
        render json: { shop: ShopSerializer.call(find_listed_shop!) }
      end

      # GET /api/v1/shops/:slug/items
      def items
        items = find_listed_shop!.items.enabled.order(:position, :created_at)
        render json: { items: items.map { |item| ItemSerializer.call(item) } }
      end

      private

      # A shop that is not open simply does not exist as far as discovery is
      # concerned (404), the same as an unknown slug.
      def find_listed_shop!
        Shop.listed.find_by!(slug: params[:slug])
      end
    end
  end
end
