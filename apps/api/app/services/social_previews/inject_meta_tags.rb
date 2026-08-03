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
      # BuildShopMeta always knows the real dimensions of whatever image_url
      # points to — the shop's cover/profile photo is served through a
      # resize_to_fill variant at a known fixed size, and the default
      # bazaar.jpg fallback's own size is hardcoded there too. So these get
      # set to the actual value rather than stripped.
      html = replace_meta(html, property: "og:image:width", value: @meta[:image_width].to_s)
      replace_meta(html, property: "og:image:height", value: @meta[:image_height].to_s)
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
