require "rails_helper"

RSpec.describe SocialPreviews::InjectMetaTags do
  let(:html) do
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

  let(:meta) do
    {
      title: "Ube or Not Ube — Prisma KapitMarket",
      description: "Homemade desserts & merienda treats.",
      image_url: "https://prisma.kapitmarket.ph/rails/active_storage/blobs/abc/ube.jpg",
      canonical_url: "https://prisma.kapitmarket.ph/shops/ube-or-not-ube"
    }
  end

  it "swaps the title, description, image, and canonical URL into every relevant tag" do
    result = described_class.new(html: html, meta: meta).call

    expect(result).to include("<title>Ube or Not Ube — Prisma KapitMarket</title>")
    expect(result).to include('name="description" content="Homemade desserts &amp; merienda treats."')
    expect(result).to include('property="og:title" content="Ube or Not Ube — Prisma KapitMarket"')
    expect(result).to include('property="og:description" content="Homemade desserts &amp; merienda treats."')
    expect(result).to include("property=\"og:image\" content=\"#{meta[:image_url]}\"")
    expect(result).to include("property=\"og:url\" content=\"#{meta[:canonical_url]}\"")
    expect(result).to include('name="twitter:title" content="Ube or Not Ube — Prisma KapitMarket"')
    expect(result).to include('name="twitter:description" content="Homemade desserts &amp; merienda treats."')
    expect(result).to include("name=\"twitter:image\" content=\"#{meta[:image_url]}\"")
  end

  it "escapes HTML-unsafe characters in shop-provided text" do
    unsafe_meta = meta.merge(title: %("><script>alert(1)</script>))
    result = described_class.new(html: html, meta: unsafe_meta).call

    expect(result).not_to include("<script>alert(1)</script>")
    expect(result).to include("&lt;script&gt;")
  end

  it "drops the default image's now-inaccurate width/height, since a shop photo rarely matches it" do
    result = described_class.new(html: html, meta: meta).call

    expect(result).not_to include("og:image:width")
    expect(result).not_to include("og:image:height")
  end

  it "leaves twitter:card and every other unrelated tag untouched" do
    result = described_class.new(html: html, meta: meta).call

    expect(result).to include('name="twitter:card" content="summary_large_image"')
    expect(result).to include('<div id="root"></div>')
  end
end
