# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_08_04_010002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "addresses", force: :cascade do |t|
    t.string "building"
    t.string "city"
    t.datetime "created_at", null: false
    t.text "delivery_instructions"
    t.string "label"
    t.string "mobile_number"
    t.text "notes"
    t.string "recipient_name"
    t.string "street_address"
    t.string "unit"
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["user_id"], name: "index_addresses_on_user_id"
  end

  create_table "admin_api_tokens", force: :cascade do |t|
    t.bigint "admin_user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at"
    t.datetime "last_used_at"
    t.string "token_digest", null: false
    t.datetime "updated_at", null: false
    t.index ["admin_user_id"], name: "index_admin_api_tokens_on_admin_user_id"
    t.index ["token_digest"], name: "index_admin_api_tokens_on_token_digest", unique: true
  end

  create_table "admin_audit_logs", force: :cascade do |t|
    t.string "action", null: false
    t.bigint "admin_user_id"
    t.string "controller", null: false
    t.datetime "created_at", null: false
    t.string "http_method", null: false
    t.string "ip_address"
    t.string "path", null: false
    t.jsonb "request_params"
    t.bigint "resource_id"
    t.string "resource_type"
    t.integer "status_code"
    t.datetime "updated_at", null: false
    t.index ["admin_user_id"], name: "index_admin_audit_logs_on_admin_user_id"
    t.index ["created_at"], name: "index_admin_audit_logs_on_created_at"
    t.index ["resource_type", "resource_id"], name: "index_admin_audit_logs_on_resource_type_and_resource_id"
  end

  create_table "admin_users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "first_name"
    t.string "last_name"
    t.datetime "last_signed_in_at"
    t.string "password_digest", null: false
    t.string "status", default: "active", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_admin_users_on_lower_email", unique: true
  end

  create_table "api_tokens", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at"
    t.datetime "last_used_at"
    t.string "token_digest", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["token_digest"], name: "index_api_tokens_on_token_digest", unique: true
    t.index ["user_id"], name: "index_api_tokens_on_user_id"
  end

  create_table "cart_items", force: :cascade do |t|
    t.bigint "cart_id", null: false
    t.datetime "created_at", null: false
    t.text "customer_note"
    t.bigint "item_id", null: false
    t.integer "quantity", default: 1, null: false
    t.datetime "updated_at", null: false
    t.index ["cart_id", "item_id"], name: "index_cart_items_on_cart_id_and_item_id", unique: true
    t.index ["cart_id"], name: "index_cart_items_on_cart_id"
    t.index ["item_id"], name: "index_cart_items_on_item_id"
  end

  create_table "carts", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "customer_profile_id", null: false
    t.bigint "shop_id", null: false
    t.string "status", default: "active", null: false
    t.datetime "updated_at", null: false
    t.index ["customer_profile_id", "shop_id"], name: "index_carts_on_customer_and_shop_when_active", unique: true, where: "((status)::text = 'active'::text)"
    t.index ["customer_profile_id"], name: "index_carts_on_customer_profile_id"
    t.index ["shop_id"], name: "index_carts_on_shop_id"
  end

  create_table "conversation_reads", force: :cascade do |t|
    t.bigint "conversation_id", null: false
    t.datetime "created_at", null: false
    t.datetime "last_read_at"
    t.bigint "last_read_message_id"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["conversation_id", "user_id"], name: "index_conversation_reads_on_conversation_and_user", unique: true
    t.index ["conversation_id"], name: "index_conversation_reads_on_conversation_id"
    t.index ["last_read_message_id"], name: "index_conversation_reads_on_last_read_message_id"
    t.index ["user_id"], name: "index_conversation_reads_on_user_id"
  end

  create_table "conversations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "order_id", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id"], name: "index_conversations_on_order_id", unique: true
  end

  create_table "customer_profiles", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "default_address_id"
    t.string "display_name", null: false
    t.boolean "is_resident", default: false, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.boolean "willing_to_verify_residency"
    t.index ["default_address_id"], name: "index_customer_profiles_on_default_address_id"
    t.index ["user_id"], name: "index_customer_profiles_on_user_id", unique: true
  end

  create_table "early_access_signups", force: :cascade do |t|
    t.string "context"
    t.datetime "created_at", null: false
    t.string "email"
    t.string "interest", default: "buyer", null: false
    t.string "mobile_number"
    t.string "name"
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_early_access_signups_on_lower_email", unique: true, where: "(email IS NOT NULL)"
    t.index ["mobile_number"], name: "index_early_access_signups_on_mobile_number", unique: true, where: "(mobile_number IS NOT NULL)"
  end

  create_table "error_logs", force: :cascade do |t|
    t.text "backtrace"
    t.datetime "created_at", null: false
    t.string "exception_class", null: false
    t.string "fingerprint", null: false
    t.datetime "first_seen_at", null: false
    t.datetime "last_seen_at", null: false
    t.text "message", null: false
    t.integer "occurrences_count", default: 1, null: false
    t.string "request_method"
    t.string "request_path"
    t.datetime "resolved_at"
    t.string "source", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["fingerprint"], name: "index_error_logs_on_fingerprint", unique: true
    t.index ["resolved_at"], name: "index_error_logs_on_resolved_at"
    t.index ["user_id"], name: "index_error_logs_on_user_id"
  end

  create_table "feedback_submissions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email"
    t.text "message", null: false
    t.string "page_url"
    t.datetime "resolved_at"
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["resolved_at"], name: "index_feedback_submissions_on_resolved_at"
    t.index ["user_id"], name: "index_feedback_submissions_on_user_id"
  end

  create_table "item_tags", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "item_id", null: false
    t.bigint "tag_id", null: false
    t.datetime "updated_at", null: false
    t.index ["item_id", "tag_id"], name: "index_item_tags_on_item_id_and_tag_id", unique: true
    t.index ["item_id"], name: "index_item_tags_on_item_id"
    t.index ["tag_id"], name: "index_item_tags_on_tag_id"
  end

  create_table "items", force: :cascade do |t|
    t.datetime "archived_at"
    t.datetime "created_at", null: false
    t.string "currency", default: "PHP", null: false
    t.text "description"
    t.boolean "enabled", default: true, null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.integer "price_cents", null: false
    t.bigint "shop_id", null: false
    t.integer "stock_count"
    t.datetime "updated_at", null: false
    t.index ["shop_id", "position"], name: "index_items_on_shop_id_and_position"
    t.index ["shop_id"], name: "index_items_on_shop_id"
  end

  create_table "messages", force: :cascade do |t|
    t.text "body"
    t.bigint "conversation_id", null: false
    t.datetime "created_at", null: false
    t.datetime "edited_at"
    t.string "message_type", default: "text", null: false
    t.bigint "sender_user_id"
    t.index ["conversation_id", "created_at"], name: "index_messages_on_conversation_id_and_created_at"
    t.index ["conversation_id"], name: "index_messages_on_conversation_id"
    t.index ["sender_user_id"], name: "index_messages_on_sender_user_id"
  end

  create_table "order_items", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "customer_note"
    t.text "item_description"
    t.bigint "item_id"
    t.string "item_name", null: false
    t.integer "line_total_cents", null: false
    t.bigint "order_id", null: false
    t.integer "quantity", null: false
    t.integer "unit_price_cents", null: false
    t.datetime "updated_at", null: false
    t.index ["item_id"], name: "index_order_items_on_item_id"
    t.index ["order_id"], name: "index_order_items_on_order_id"
  end

  create_table "order_status_events", force: :cascade do |t|
    t.bigint "actor_user_id", null: false
    t.datetime "created_at", null: false
    t.string "from_status"
    t.bigint "order_id", null: false
    t.text "reason"
    t.string "reason_code"
    t.string "to_status", null: false
    t.index ["actor_user_id"], name: "index_order_status_events_on_actor_user_id"
    t.index ["order_id"], name: "index_order_status_events_on_order_id"
  end

  create_table "orders", force: :cascade do |t|
    t.datetime "accepted_at"
    t.datetime "cancelled_at"
    t.bigint "cart_id"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.string "currency", default: "PHP", null: false
    t.text "customer_note"
    t.bigint "customer_profile_id", null: false
    t.string "fulfillment_method", null: false
    t.string "payment_status", default: "unpaid", null: false
    t.datetime "placed_at", null: false
    t.string "public_reference", null: false
    t.bigint "shop_id", null: false
    t.string "status", default: "placed", null: false
    t.integer "subtotal_cents", null: false
    t.integer "total_cents", null: false
    t.datetime "updated_at", null: false
    t.text "vendor_note"
    t.index ["cart_id"], name: "index_orders_on_cart_id"
    t.index ["customer_profile_id", "status"], name: "index_orders_on_customer_profile_id_and_status"
    t.index ["customer_profile_id"], name: "index_orders_on_customer_profile_id"
    t.index ["public_reference"], name: "index_orders_on_public_reference", unique: true
    t.index ["shop_id", "status"], name: "index_orders_on_shop_id_and_status"
    t.index ["shop_id"], name: "index_orders_on_shop_id"
  end

  create_table "ratings", force: :cascade do |t|
    t.text "comment"
    t.datetime "created_at", null: false
    t.bigint "order_id", null: false
    t.bigint "reviewee_id", null: false
    t.string "reviewee_type", null: false
    t.bigint "reviewer_user_id", null: false
    t.integer "score", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id", "reviewer_user_id", "reviewee_type", "reviewee_id"], name: "index_ratings_on_order_reviewer_reviewee", unique: true
    t.index ["order_id"], name: "index_ratings_on_order_id"
    t.index ["reviewee_type", "reviewee_id"], name: "index_ratings_on_reviewee"
    t.index ["reviewer_user_id"], name: "index_ratings_on_reviewer_user_id"
  end

  create_table "shops", force: :cascade do |t|
    t.boolean "accepting_orders", default: false, null: false
    t.string "address"
    t.string "building"
    t.string "contact_number"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "fulfillment_methods", default: [], null: false, array: true
    t.string "name", null: false
    t.text "opening_message"
    t.string "slug", null: false
    t.string "status", default: "draft", null: false
    t.datetime "updated_at", null: false
    t.bigint "vendor_profile_id", null: false
    t.index ["slug"], name: "index_shops_on_slug", unique: true
    t.index ["status", "accepting_orders"], name: "index_shops_on_status_and_accepting_orders"
    t.index ["vendor_profile_id"], name: "index_shops_on_vendor_profile_id"
  end

  create_table "tags", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_tags_on_slug", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.boolean "email_marketing_opt_in", default: false, null: false
    t.datetime "email_verified_at"
    t.string "first_name"
    t.string "last_name"
    t.datetime "last_signed_in_at"
    t.string "mobile_number"
    t.datetime "mobile_verified_at"
    t.string "password_digest", null: false
    t.boolean "sms_marketing_opt_in", default: false, null: false
    t.string "status", default: "active", null: false
    t.datetime "terms_accepted_at"
    t.string "terms_version"
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
    t.index ["mobile_number"], name: "index_users_on_mobile_number", unique: true, where: "(mobile_number IS NOT NULL)"
  end

  create_table "vendor_customer_notes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "customer_profile_id", null: false
    t.boolean "flagged", default: false, null: false
    t.text "note", null: false
    t.bigint "order_id"
    t.datetime "updated_at", null: false
    t.bigint "vendor_profile_id", null: false
    t.index ["customer_profile_id"], name: "index_vendor_customer_notes_on_customer_profile_id"
    t.index ["order_id"], name: "index_vendor_customer_notes_on_order_id"
    t.index ["vendor_profile_id", "customer_profile_id"], name: "index_vendor_customer_notes_on_vendor_and_customer"
    t.index ["vendor_profile_id"], name: "index_vendor_customer_notes_on_vendor_profile_id"
  end

  create_table "vendor_profiles", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "display_name", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.string "verification_status", default: "unverified", null: false
    t.index ["user_id"], name: "index_vendor_profiles_on_user_id", unique: true
  end

  create_table "verification_challenges", force: :cascade do |t|
    t.integer "attempts_count", default: 0, null: false
    t.string "channel", null: false
    t.string "code_digest", null: false
    t.datetime "consumed_at"
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "purpose", null: false
    t.string "sent_to", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id", "channel", "purpose", "consumed_at"], name: "idx_on_user_id_channel_purpose_consumed_at_3e53850e3b"
    t.index ["user_id"], name: "index_verification_challenges_on_user_id"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "addresses", "users"
  add_foreign_key "admin_api_tokens", "admin_users"
  add_foreign_key "admin_audit_logs", "admin_users", on_delete: :nullify
  add_foreign_key "api_tokens", "users"
  add_foreign_key "cart_items", "carts"
  add_foreign_key "cart_items", "items"
  add_foreign_key "carts", "customer_profiles"
  add_foreign_key "carts", "shops"
  add_foreign_key "conversation_reads", "conversations"
  add_foreign_key "conversation_reads", "messages", column: "last_read_message_id"
  add_foreign_key "conversation_reads", "users"
  add_foreign_key "conversations", "orders"
  add_foreign_key "customer_profiles", "addresses", column: "default_address_id"
  add_foreign_key "customer_profiles", "users"
  add_foreign_key "error_logs", "users"
  add_foreign_key "feedback_submissions", "users"
  add_foreign_key "item_tags", "items"
  add_foreign_key "item_tags", "tags"
  add_foreign_key "items", "shops"
  add_foreign_key "messages", "conversations"
  add_foreign_key "messages", "users", column: "sender_user_id"
  add_foreign_key "order_items", "items"
  add_foreign_key "order_items", "orders"
  add_foreign_key "order_status_events", "orders"
  add_foreign_key "order_status_events", "users", column: "actor_user_id"
  add_foreign_key "orders", "carts"
  add_foreign_key "orders", "customer_profiles"
  add_foreign_key "orders", "shops"
  add_foreign_key "ratings", "orders"
  add_foreign_key "ratings", "users", column: "reviewer_user_id"
  add_foreign_key "shops", "vendor_profiles"
  add_foreign_key "vendor_customer_notes", "customer_profiles"
  add_foreign_key "vendor_customer_notes", "orders"
  add_foreign_key "vendor_customer_notes", "vendor_profiles"
  add_foreign_key "vendor_profiles", "users"
  add_foreign_key "verification_challenges", "users"
end
