module Api
  module V1
    # Customer-facing discovery. Only open shops (active + accepting orders) are
    # visible, and only enabled items within them. Public (no login) so people
    # can browse the community as a hook before signing up. It is still not a
    # public search index — there is no geo/distance discovery (ADR 0002).
    class ShopsController < BaseController
      skip_before_action :authenticate!

      RATINGS_DEFAULT_LIMIT = 20
      RATINGS_MAX_LIMIT = 100

      # GET /api/v1/shops?q=bread
      #
      # Eager-loads everything ShopSerializer touches per shop (vendor_profile's
      # user for #demo?, ratings, items for price_range_cents, and the profile/
      # cover photo attachments+blobs) so listing N shops doesn't cost N times
      # the per-shop query count. profile_photo is has_many_attached under the
      # hood (see ShopSerializer), so the preloadable association is the plural
      # attachments, not a singular "_attachment" one (same pattern as
      # OrdersController#index). completed_orders_count is computed as one
      # grouped query instead of one COUNT per shop.
      def index
        scope = Shop.listed.search(params[:q])
                     .includes(
                       vendor_profile: :user,
                       ratings: [],
                       items: [],
                       profile_photo_attachments: :blob,
                       cover_photo_attachments: :blob
                     )
                     .distinct
        shops = ShopRotation.order(scope)
        completed_counts = Order.where(shop_id: shops.map(&:id), status: "completed").group(:shop_id).count
        render json: {
          shops: shops.map do |shop|
            ShopSerializer.call(shop, completed_orders_count: completed_counts[shop.id] || 0)
          end
        }
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

      # GET /api/v1/shops/:slug/ratings?limit=20&offset=0
      # Public, newest first. Small fixed-window paging is enough here — a
      # neighbourhood shop's review list is short by construction.
      def ratings
        ratings = find_listed_shop!.ratings
                                   .order(created_at: :desc)
                                   .limit(params.fetch(:limit, RATINGS_DEFAULT_LIMIT).to_i.clamp(1, RATINGS_MAX_LIMIT))
                                   .offset(params.fetch(:offset, 0).to_i)
        render json: { ratings: ratings.map { |rating| RatingSerializer.call(rating) } }
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
