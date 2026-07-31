# Serves the two SPAs' index.html files for any client-side route (see
# config/routes.rb) — vendor-web under /vendor/*, customer-web everywhere
# else. Public/unauthenticated on purpose, same as any static HTML page —
# each SPA handles its own login redirect once it boots. send_file (not
# render file:) since this is an API-only app with no ActionView rendering
# pipeline.
class StaticController < ApplicationController
  def vendor_app
    serve_spa Rails.root.join("public/vendor/index.html"), build_hint: "apps/vendor-web"
  end

  def customer_app
    serve_spa Rails.root.join("public/index.html"), build_hint: "apps/customer-web"
  end

  private

  def serve_spa(index_path, build_hint:)
    if File.exist?(index_path)
      send_file index_path, type: "text/html", disposition: "inline"
    else
      render plain: "#{build_hint} build not found — run `npm run build` there and copy " \
                    "dist/ into the right apps/api/public location", status: :not_found
    end
  end
end
