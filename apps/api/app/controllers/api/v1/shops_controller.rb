module Api
  module V1
    # Customer-facing discovery. Only open shops (active + accepting orders) are
    # visible, and only enabled items within them. Public (no login) so people
    # can browse the community as a hook before signing up. It is still not a
    # public search index — there is no geo/distance discovery (ADR 0002).
    class ShopsController < BaseController
      skip_before_action :authenticate!

      # GET /api/v1/shops?q=bread
      def index
        scope = Shop.listed.search(params[:q]).includes(:vendor_profile).distinct
        shops = ShopRotation.order(scope)
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
