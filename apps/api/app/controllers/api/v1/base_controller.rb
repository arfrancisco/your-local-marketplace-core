module Api
  module V1
    # All authenticated v1 endpoints inherit from here: authentication is
    # required by default. Public endpoints (register, login, discovery) skip it
    # explicitly with `skip_before_action :authenticate!`.
    class BaseController < ApplicationController
      before_action :authenticate!
    end
  end
end
