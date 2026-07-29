# Serializes Active Storage attachments. Returns only-path blob URLs (e.g.
# /rails/active_storage/blobs/...) so no host configuration is needed; clients
# resolve them against the API base URL. In production these redirect to R2.
module PhotoSerializer
  extend self
  include Rails.application.routes.url_helpers

  # Required by the url helpers even when every call passes only_path: true.
  def default_url_options
    {}
  end

  def list(attached)
    attached.map { |photo| one(photo) }
  end

  def one(photo)
    {
      id: photo.id,
      url: rails_blob_path(photo, only_path: true),
      filename: photo.filename.to_s,
      byte_size: photo.byte_size,
      content_type: photo.content_type
    }
  end
end
