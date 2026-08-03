module Api
  module V1
    module Vendor
      class ShopsController < BaseController
        before_action :set_shop, only: %i[show update open close destroy_profile_photo destroy_cover_photo
                                           destroy_opening_message_photo]

        # GET /api/v1/vendor/shops
        def index
          shops = current_vendor_profile.shops.order(created_at: :desc)
          render json: { shops: shops.map { |shop| ShopSerializer.call(shop, include_payment_info: true) } }
        end

        # GET /api/v1/vendor/shops/:id
        def show
          render json: { shop: ShopSerializer.call(@shop, include_payment_info: true) }
        end

        # POST /api/v1/vendor/shops
        def create
          shop = current_vendor_profile.shops.new(shop_params)
          authorize shop
          attach_photos(shop)
          shop.save!
          render json: { shop: ShopSerializer.call(shop, include_payment_info: true) }, status: :created
        end

        # PATCH /api/v1/vendor/shops/:id
        def update
          @shop.assign_attributes(shop_params)
          attach_photos(@shop)
          @shop.save!
          render json: { shop: ShopSerializer.call(@shop, include_payment_info: true) }
        end

        # POST /api/v1/vendor/shops/:id/open
        def open
          @shop.open!
          render json: { shop: ShopSerializer.call(@shop, include_payment_info: true) }
        end

        # POST /api/v1/vendor/shops/:id/close
        def close
          @shop.close!
          render json: { shop: ShopSerializer.call(@shop, include_payment_info: true) }
        end

        # DELETE /api/v1/vendor/shops/:id/profile_photo
        def destroy_profile_photo
          @shop.profile_photo.purge
          head :no_content
        end

        # DELETE /api/v1/vendor/shops/:id/cover_photo
        def destroy_cover_photo
          @shop.cover_photo.purge
          head :no_content
        end

        # DELETE /api/v1/vendor/shops/:id/opening_message_photos/:photo_id
        def destroy_opening_message_photo
          @shop.opening_message_photos_attachments.find(params[:photo_id]).purge
          head :no_content
        end

        private

        # Scoping the lookup to the current vendor's shops means another vendor's
        # id simply 404s (it never reveals that the shop exists). authorize adds
        # a second, explicit ownership check.
        def set_shop
          @shop = current_vendor_profile.shops.find(params[:id])
          authorize @shop
        end

        def shop_params
          params.require(:shop).permit(:name, :description, :contact_number, :building, :address,
                                        :opening_message, fulfillment_methods: [])
        end

        def attach_photos(shop)
          # Single-image fields: a new upload replaces whatever was there,
          # it doesn't add a second attachment (which max_count: 1 would
          # then reject anyway) — purge is a no-op when nothing's attached
          # yet, so this is safe on both create and update.
          if (profile_photo = params.dig(:shop, :profile_photo)).present?
            shop.profile_photo.purge
            shop.profile_photo.attach(profile_photo)
          end

          if (cover_photo = params.dig(:shop, :cover_photo)).present?
            shop.cover_photo.purge
            shop.cover_photo.attach(cover_photo)
          end

          opening_message_photos = params.dig(:shop, :opening_message_photos)
          shop.opening_message_photos.attach(opening_message_photos) if opening_message_photos.present?
        end
      end
    end
  end
end
