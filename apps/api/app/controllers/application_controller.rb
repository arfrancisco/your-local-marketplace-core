class ApplicationController < ActionController::API
  include Pundit::Authorization
  include ErrorHandling
  include Authentication
end
