module Api
  module V1
    module Admin
      # Spam/junk lead cleanup — this is the pre-launch demand-test capture,
      # not an active flow anymore, but old rows are still worth browsing.
      class EarlyAccessSignupsController < BaseController
        # GET /api/v1/admin/early_access_signups
        def index
          scope = EarlyAccessSignup.order(created_at: :desc)
          render json: {
            early_access_signups: paginate(scope).map { |s| ::Admin::EarlyAccessSignupSerializer.call(s) },
            meta: pagination_meta(scope)
          }
        end

        # DELETE /api/v1/admin/early_access_signups/:id
        def destroy
          EarlyAccessSignup.find(params[:id]).destroy!
          head :no_content
        end
      end
    end
  end
end
