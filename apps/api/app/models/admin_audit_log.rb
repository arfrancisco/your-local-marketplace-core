# A best-effort record of "who did what" for the admin surface, written by
# Api::V1::Admin::BaseController's record_audit_log around_action. Thin on
# purpose — an approximate action log (method/path/resource/status/params),
# not a full before/after diff.
class AdminAuditLog < ApplicationRecord
  belongs_to :admin_user, optional: true
end
