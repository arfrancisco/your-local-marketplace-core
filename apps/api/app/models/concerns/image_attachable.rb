# Server-side enforcement of the ADR 0006 image rules. The limits live here, in
# the API layer, on purpose: the same rules must hold for the web clients and a
# future mobile client, so the clients cannot be trusted to enforce them.
#
#   has_images :photos, max_count: 6
#
# validates allowed content types, per-file size, and how many may be attached.
module ImageAttachable
  extend ActiveSupport::Concern

  ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/webp].freeze
  MAX_BYTES = 5.megabytes

  class_methods do
    def has_images(name, max_count:)
      has_many_attached name

      validate do
        attachments = public_send(name).attachments

        if attachments.size > max_count
          errors.add(name, "cannot have more than #{max_count} images")
        end

        attachments.each do |attachment|
          blob = attachment.blob
          next if blob.nil?

          unless ImageAttachable::ALLOWED_CONTENT_TYPES.include?(blob.content_type)
            errors.add(name, "must be a JPEG, PNG, or WebP image")
          end

          if blob.byte_size.to_i > ImageAttachable::MAX_BYTES
            errors.add(name, "must be 5 MB or smaller")
          end
        end
      end
    end
  end
end
