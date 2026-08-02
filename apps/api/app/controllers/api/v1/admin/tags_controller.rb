module Api
  module V1
    module Admin
      # Hygiene/dedup cleanup only — tags are otherwise managed transitively
      # through items (Tag.for_names), never created directly here.
      class TagsController < BaseController
        # GET /api/v1/admin/tags
        def index
          scope = Tag.order(:name)
          tags = paginate(scope).map { |t| { id: t.id, name: t.name, slug: t.slug, item_count: t.items.count } }
          render json: { tags: tags, meta: pagination_meta(scope) }
        end

        # DELETE /api/v1/admin/tags/:id
        def destroy
          Tag.find(params[:id]).destroy!
          head :no_content
        end
      end
    end
  end
end
