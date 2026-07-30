module Api
  module V1
    class TagsController < BaseController
      skip_before_action :authenticate! # public: browsing is open (see ShopsController)

      # GET /api/v1/tags
      def index
        tags = Tag.order(:name)
        render json: { tags: tags.map { |tag| { id: tag.id, name: tag.name, slug: tag.slug } } }
      end
    end
  end
end
