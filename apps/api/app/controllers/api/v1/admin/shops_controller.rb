module Api
  module V1
    module Admin
      class ShopsController < BaseController
        before_action :set_shop, only: %i[show update destroy]

        # GET /api/v1/admin/shops?status=suspended&q=pizza&demo=true
        def index
          scope = filter_by_demo(Shop.order(created_at: :desc))
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where("name ILIKE :q", q: "%#{params[:q]}%") if params[:q].present?
          render json: {
            # No include_vendor here: the list view only ever renders
            # vendor_verification_status (see ShopsPage), so building the
            # full nested vendor+user object per row would just be
            # unused work on every page load.
            shops: paginate(scope).map { |s| admin_shop_json(s) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { shop: admin_shop_json(@shop, include_vendor: true) }
        end

        # PATCH /api/v1/admin/shops/:id
        def update
          @shop.update!(shop_params)
          render json: { shop: admin_shop_json(@shop, include_vendor: true) }
        end

        # DELETE /api/v1/admin/shops/:id
        def destroy
          @shop.destroy!
          head :no_content
        end

        private

        def set_shop
          @shop = Shop.find(params[:id])
        end

        def shop_params
          params.require(:shop).permit(:name, :description, :status, :accepting_orders, :contact_number, :address)
        end

        # Adds the vendor's own verification status on top of the shared
        # ShopSerializer payload (demo is already on that shared payload, see
        # ShopSerializer) so the admin panel can badge a shop as "fully
        # verified" without exposing this on the public/customer-facing
        # serializer.
        #
        # include_vendor additionally nests the owning vendor profile and its
        # underlying user (display name, verification status, email, mobile,
        # account status/verification) so the shop detail page can show
        # everything connected to a shop without the admin having to
        # separately search VendorProfilesPage/UsersPage for the matching
        # record. Kept opt-in (rather than always merged) because it's
        # unused shape on the shops *list* — see index above.
        def admin_shop_json(shop, include_vendor: false)
          json = ShopSerializer.call(shop, include_payment_info: true).merge(
            vendor_verification_status: shop.vendor_profile.verification_status
          )
          return json unless include_vendor

          json.merge(vendor: vendor_json(shop.vendor_profile))
        end

        def vendor_json(vendor_profile)
          user = vendor_profile.user
          {
            id: vendor_profile.id,
            display_name: vendor_profile.display_name,
            verification_status: vendor_profile.verification_status,
            cancellation_restricted_at: vendor_profile.cancellation_restricted_at,
            cancellation_restriction_count: vendor_profile.cancellation_restriction_count,
            created_at: vendor_profile.created_at,
            user: {
              id: user.id,
              email: user.email,
              mobile_number: user.mobile_number,
              status: user.status,
              email_verified: user.email_verified?,
              mobile_verified: user.mobile_verified?,
              demo: user.demo?
            }
          }
        end
      end
    end
  end
end
