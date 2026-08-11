require "rails_helper"

RSpec.describe "Short link redirects", type: :request do
  describe "GET /s/:code" do
    it "redirects a customer-audience link to the customer order page" do
      order = create(:order)
      short_link = ShortLink.for(order: order, audience: "customer")

      get "/s/#{short_link.code}"

      expect(response).to redirect_to("/orders/#{order.id}")
    end

    it "redirects a vendor-audience link to the vendor order page" do
      order = create(:order)
      short_link = ShortLink.for(order: order, audience: "vendor")

      get "/s/#{short_link.code}"

      expect(response).to redirect_to("/vendor/orders/#{order.id}")
    end

    it "redirects an unknown code to the home page rather than erroring" do
      get "/s/nosuchcode"

      expect(response).to redirect_to("/")
    end

    it "is not swallowed by the customer-web SPA catch-all" do
      order = create(:order)
      short_link = ShortLink.for(order: order, audience: "customer")

      get "/s/#{short_link.code}"

      # The SPA catch-all renders the built index.html with a 200; a route
      # that actually resolved to ShortLinksController#show issues a 302
      # instead, so this status alone proves the route wasn't shadowed.
      expect(response).to have_http_status(:found)
    end
  end
end
