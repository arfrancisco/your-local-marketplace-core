# Shared behavior for every Api::V1::Admin endpoint: a per-admin bearer
# token is the entire authorization boundary for this namespace. Include with
# `it_behaves_like "requires admin auth"` and a `let(:request_method)` /
# `let(:request_path)` (and optional `let(:request_params)`) already defined
# in the including spec.
RSpec.shared_examples "requires admin auth" do
  it "rejects a request with no Authorization header" do
    public_send(request_method, request_path, params: defined?(request_params) ? request_params : {})
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects a request with an invalid token" do
    public_send(request_method, request_path,
                 params: defined?(request_params) ? request_params : {},
                 headers: { "Authorization" => "Bearer not-a-real-token" })
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects a request with an expired token" do
    admin_user = FactoryBot.create(:admin_user)
    _record, raw = AdminApiToken.issue!(admin_user)
    AdminApiToken.last.update!(expires_at: 1.second.ago)

    public_send(request_method, request_path,
                 params: defined?(request_params) ? request_params : {},
                 headers: { "Authorization" => "Bearer #{raw}" })
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects a request from a suspended admin" do
    admin_user = FactoryBot.create(:admin_user, :suspended)
    _record, raw = AdminApiToken.issue!(admin_user)

    public_send(request_method, request_path,
                 params: defined?(request_params) ? request_params : {},
                 headers: { "Authorization" => "Bearer #{raw}" })
    expect(response).to have_http_status(:unauthorized)
  end

  it "accepts a request with a valid admin token" do
    public_send(request_method, request_path,
                 params: defined?(request_params) ? request_params : {},
                 headers: admin_auth_headers)
    expect(response).not_to have_http_status(:unauthorized)
  end
end
