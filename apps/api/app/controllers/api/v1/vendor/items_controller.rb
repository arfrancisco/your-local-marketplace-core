module Api
  module V1
    module Vendor
      class ItemsController < BaseController
        before_action :set_shop, only: %i[index create]
        before_action :set_item, only: %i[update enable disable destroy_photo]

        # GET /api/v1/vendor/shops/:shop_id/items
        def index
          items = @shop.items.order(:position, :created_at)
          render json: { items: items.map { |item| ItemSerializer.call(item) } }
        end

        # POST /api/v1/vendor/shops/:shop_id/items
        def create
          item = @shop.items.new(item_params)
          assign_tags(item)
          attach_photos(item)
          item.save!
          render json: { item: ItemSerializer.call(item) }, status: :created
        end

        # PATCH /api/v1/vendor/items/:id
        def update
          @item.assign_attributes(item_params)
          assign_tags(@item)
          attach_photos(@item)
          @item.save!
          render json: { item: ItemSerializer.call(@item) }
        end

        # POST /api/v1/vendor/items/:id/enable
        def enable
          @item.enable!
          render json: { item: ItemSerializer.call(@item) }
        end

        # POST /api/v1/vendor/items/:id/disable
        def disable
          @item.disable!
          render json: { item: ItemSerializer.call(@item) }
        end

        # DELETE /api/v1/vendor/items/:id/photos/:photo_id
        def destroy_photo
          @item.photos_attachments.find(params[:photo_id]).purge
          head :no_content
        end

        private

        def set_shop
          @shop = current_vendor_profile.shops.find(params[:shop_id])
          authorize @shop, :manage_items?
        end

        def set_item
          @item = Item.joins(shop: :vendor_profile)
                      .where(vendor_profiles: { user_id: current_user.id })
                      .find(params[:id])
          authorize @item
        end

        def item_params
          params.require(:item).permit(:name, :description, :price_cents, :currency, :position, :enabled, :stock_count)
        end

        # Tags are free-text names resolved (created if new) to Tag records. An
        # empty array clears tags; omitting the key leaves them unchanged.
        def assign_tags(item)
          names = params.dig(:item, :tags)
          return if names.nil?

          item.tags = Tag.for_names(names)
        end

        def attach_photos(item)
          photos = params.dig(:item, :photos)
          item.photos.attach(photos) if photos.present?
        end
      end
    end
  end
end
