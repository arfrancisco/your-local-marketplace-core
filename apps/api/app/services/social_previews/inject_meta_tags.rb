require "erb"

module SocialPreviews
  # Swaps the shop-specific values into an already-built index.html (the same
  # file real visitors get), rather than hand-building a separate document —
  # one shell stays the source of truth for everything else in <head>
  # (fonts, the JS/CSS bundle Vite hashed at build time, etc.).
  #
  # Matches on each tag's stable name/property attribute rather than the
  # current default text, so this keeps working if the copy in index.html
  # changes later without needing to stay in sync with a duplicated string.
  class InjectMetaTags
    def initialize(html:, meta:)
      @html = html
      @meta = meta
    end

    def call
      html = @html.dup
      html = replace_content(html, tag: %(<title>.*?</title>)) { "<title>#{escape(@meta[:title])}</title>" }
      html = replace_meta(html, name: "description", value: @meta[:description])
      html = replace_meta(html, property: "og:title", value: @meta[:title])
      html = replace_meta(html, property: "og:description", value: @meta[:description])
      html = replace_meta(html, property: "og:image", value: @meta[:image_url])
      html = replace_meta(html, property: "og:url", value: @meta[:canonical_url])
      html = replace_meta(html, name: "twitter:title", value: @meta[:title])
      html = replace_meta(html, name: "twitter:description", value: @meta[:description])
      html = replace_meta(html, name: "twitter:image", value: @meta[:image_url])
      # A shop's own photo isn't guaranteed to be the default bazaar.jpg's
      # 1920x1280 — drop the now-inaccurate explicit dimensions rather than
      # mislead crawlers that don't refetch the image to verify them.
      html.gsub(%r{\s*<meta property="og:image:(?:width|height)" content="\d+"\s*/>\n?}, "")
    end

    private

    def replace_content(html, tag:)
      html.sub(Regexp.new(tag, Regexp::MULTILINE)) { yield }
    end

    def replace_meta(html, value:, name: nil, property: nil)
      attr = name ? %(name="#{name}") : %(property="#{property}")
      pattern = %r{(<meta #{Regexp.escape(attr)} content=")[^"]*("\s*/?>)}
      html.sub(pattern) { "#{Regexp.last_match(1)}#{escape(value)}#{Regexp.last_match(2)}" }
    end

    def escape(value)
      ERB::Util.html_escape(value)
    end
  end
end
