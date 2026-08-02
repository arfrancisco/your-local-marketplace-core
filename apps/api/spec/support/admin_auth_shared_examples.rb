# Shared behavior for every Api::V1::Admin endpoint: Basic Auth is the
# entire authorization boundary for this namespace. Include with
# `it_behaves_like "requires admin basic auth"` and a `let(:request_method)`
# / `let(:request_path)` (and optional `let(:request_params)`) already
# defined in the including spec.
RSpec.shared_examples "requires admin basic auth" do
  it "rejects a request with no Authorization header" do
    public_send(request_method, request_path, params: defined?(request_params) ? request_params : {})
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects a request with the wrong credentials" do
    public_send(request_method, request_path,
                 params: defined?(request_params) ? request_params : {},
                 headers: admin_auth_headers(username: "wrong", password: "wrong"))
    expect(response).to have_http_status(:unauthorized)
  end

  it "accepts a request with the correct admin credentials" do
    public_send(request_method, request_path,
                 params: defined?(request_params) ? request_params : {},
                 headers: admin_auth_headers)
    expect(response).not_to have_http_status(:unauthorized)
  end
end
