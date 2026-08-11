# Public redirect for order-lifecycle SMS short links (GET /s/:code). No
# authentication: this inherits directly from ApplicationController (not
# Api::V1::BaseController, whose `before_action :authenticate!` requires a
# skip), same as StaticController — the redirect itself reveals nothing
# sensitive (a relative path, same host); real authorization happens when
# the destination order page loads and fetches the order over the
# authenticated API, same reasoning already applied to using the raw order
# id in the link at all.
class ShortLinksController < ApplicationController
  # GET /s/:code
  def show
    short_link = ShortLink.find_by(code: params[:code])

    if short_link
      redirect_to short_link.target_path
    else
      redirect_to "/"
    end
  end
end
