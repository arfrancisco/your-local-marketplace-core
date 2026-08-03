require "rails_helper"

# Exercises the crawler-only Open Graph swap (see StaticController#customer_app
# and the SocialPreviews:: services). Frontend builds aren't produced in CI
# (see .github/workflows/api-ci.yml), so this writes its own minimal
# public/index.html fixture rather than depending on one already existing,
# restoring whatever was there (if anything) afterwards.
RSpec.describe "StaticController social previews", type: :request do
  let(:index_path) { Rails.root.join("public/index.html") }
  let(:fixture_html) do
    <<~HTML
      <!doctype html>
      <html>
        <head>
          <title>Prisma KapitMarket — By the community, for the community</title>
          <meta name="description" content="Default description" />
          <meta property="og:title" content="Prisma KapitMarket — By the community, for the community" />
          <meta property="og:description" content="Default description" />
          <meta property="og:image" content="https://prisma.kapitmarket.ph/bazaar.jpg" />
          <meta property="og:image:width" content="1920" />
          <meta property="og:image:height" content="1280" />
          <meta property="og:url" content="https://prisma.kapitmarket.ph/shops" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Prisma KapitMarket — By the community, for the community" />
          <meta name="twitter:description" content="Default description" />
          <meta name="twitter:image" content="https://prisma.kapitmarket.ph/bazaar.jpg" />
        </head>
        <body><div id="root"></div></body>
      </html>
    HTML
  end

  around do |example|
    existed = File.exist?(index_path)
    original = File.read(index_path, encoding: "UTF-8") if existed
    File.write(index_path, fixture_html, encoding: "UTF-8")
    example.run
    existed ? File.write(index_path, original, encoding: "UTF-8") : File.delete(index_path)
  end

  let(:shop) do
    create(:shop, :open, name: "Ube or Not Ube", slug: "ube-or-not-ube",
                          description: "Homemade desserts and merienda treats.")
  end
  let(:facebook_ua) { "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" }
  let(:browser_ua) { "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15" }

  # send_file (the plain-shell path) returns bytes tagged BINARY rather than
  # UTF-8 — re-tagging (not transcoding) is enough since the file itself is
  # already valid UTF-8, and avoids Encoding::CompatibilityError comparing
  # against a UTF-8 literal containing the em dash.
  def body
    response.body.dup.force_encoding("UTF-8")
  end

  it "serves the plain shell to an ordinary browser on a shop page" do
    get "/shops/#{shop.slug}", headers: { "User-Agent" => browser_ua }

    expect(body).to include("<title>Prisma KapitMarket — By the community, for the community</title>")
    expect(body).not_to include(shop.name)
  end

  it "serves shop-specific Open Graph tags to a recognized social crawler" do
    get "/shops/#{shop.slug}", headers: { "User-Agent" => facebook_ua }

    expect(body).to include("<title>#{shop.name} — Prisma KapitMarket</title>")
    expect(body).to include(%(property="og:title" content="#{shop.name} — Prisma KapitMarket"))
    expect(body).to include(%(property="og:description" content="#{shop.description}"))
    expect(body).to include(%(property="og:url" content="http://www.example.com/shops/#{shop.slug}"))
  end

  it "falls back to the plain shell for a crawler hitting an unknown shop slug" do
    get "/shops/does-not-exist", headers: { "User-Agent" => facebook_ua }

    expect(body).to include("<title>Prisma KapitMarket — By the community, for the community</title>")
  end

  it "falls back to the plain shell for a crawler on the landing page" do
    get "/", headers: { "User-Agent" => facebook_ua }

    expect(body).to include("<title>Prisma KapitMarket — By the community, for the community</title>")
  end
end
