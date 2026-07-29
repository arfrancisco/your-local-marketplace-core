require "rails_helper"

RSpec.describe "Api::V1 Health", type: :request do
  it "reports ok when the database is reachable" do
    get "/api/v1/health"
    expect(response).to have_http_status(:ok)
    expect(json["status"]).to eq("ok")
  end
end
