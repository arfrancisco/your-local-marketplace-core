# Serves the three SPAs' index.html files for any client-side route (see
# config/routes.rb) — vendor-web under /vendor/*, admin-web under /admin/*,
# customer-web everywhere else. Public/unauthenticated on purpose, same as
# any static HTML page — each SPA handles its own login redirect once it
# boots (admin-web's login is HTTP Basic against the Api::V1::Admin API,
# not this shell). send_file (not render file:) since this is an API-only
# app with no ActionView rendering pipeline.
class StaticController < ApplicationController
  SHOP_PATH_PATTERN = %r{\A/shops/([^/]+)/?\z}

  def vendor_app
    serve_spa Rails.root.join("public/vendor/index.html"), build_hint: "apps/vendor-web"
  end

  def admin_app
    serve_spa Rails.root.join("public/admin/index.html"), build_hint: "apps/admin-web"
  end

  # Real visitors always get the plain built file below, untouched — only
  # requests from a recognized social-media crawler on a /shops/:slug URL get
  # the shop-specific swap, so link unfurls show that shop's own name/photo
  # instead of the site-wide default every other page falls back to (see
  # index.html and the SocialPreviews:: services this calls into).
  def customer_app
    index_path = Rails.root.join("public/index.html")
    return serve_spa(index_path, build_hint: "apps/customer-web") unless File.exist?(index_path)

    shop = crawler_shop_for_request
    return serve_spa(index_path, build_hint: "apps/customer-web") unless shop

    meta = SocialPreviews::BuildShopMeta.new(shop: shop, base_url: request.base_url).call
    html = SocialPreviews::InjectMetaTags.new(html: File.read(index_path, encoding: "UTF-8"), meta: meta).call
    # render html: needs the ActionView layer this API-only app doesn't have —
    # plain text with an explicit content type is what render plain: below
    # (the not-found branch) already relies on.
    render plain: html, content_type: "text/html"
  end

  private

  def crawler_shop_for_request
    return unless SocialPreviews::DetectCrawler.bot?(request.user_agent)

    slug = request.path[SHOP_PATH_PATTERN, 1]
    return unless slug

    Shop.listed.find_by(slug: slug)
  end

  def serve_spa(index_path, build_hint:)
    if File.exist?(index_path)
      send_file index_path, type: "text/html", disposition: "inline"
    else
      render plain: "#{build_hint} build not found — run `npm run build` there and copy " \
                    "dist/ into the right apps/api/public location", status: :not_found
    end
  end
end
