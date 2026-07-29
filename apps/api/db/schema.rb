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

ActiveRecord::Schema[8.1].define(version: 2026_07_29_100004) do
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
    t.datetime "created_at", null: false
    t.text "delivery_instructions"
    t.string "label"
    t.string "mobile_number"
    t.text "notes"
    t.string "recipient_name"
    t.string "unit"
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["user_id"], name: "index_addresses_on_user_id"
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

  create_table "customer_profiles", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "default_address_id"
    t.string "display_name", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["default_address_id"], name: "index_customer_profiles_on_default_address_id"
    t.index ["user_id"], name: "index_customer_profiles_on_user_id", unique: true
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
    t.datetime "created_at", null: false
    t.string "currency", default: "PHP", null: false
    t.text "description"
    t.boolean "enabled", default: true, null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.integer "price_cents", null: false
    t.bigint "shop_id", null: false
    t.datetime "updated_at", null: false
    t.index ["shop_id", "position"], name: "index_items_on_shop_id_and_position"
    t.index ["shop_id"], name: "index_items_on_shop_id"
  end

  create_table "shops", force: :cascade do |t|
    t.boolean "accepting_orders", default: false, null: false
    t.string "address"
    t.string "contact_number"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "fulfillment_methods", default: [], null: false, array: true
    t.string "name", null: false
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
    t.datetime "email_verified_at"
    t.datetime "last_signed_in_at"
    t.string "mobile_number"
    t.datetime "mobile_verified_at"
    t.string "password_digest", null: false
    t.string "status", default: "active", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
    t.index ["mobile_number"], name: "index_users_on_mobile_number", unique: true, where: "(mobile_number IS NOT NULL)"
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
  add_foreign_key "api_tokens", "users"
  add_foreign_key "customer_profiles", "addresses", column: "default_address_id"
  add_foreign_key "customer_profiles", "users"
  add_foreign_key "item_tags", "items"
  add_foreign_key "item_tags", "tags"
  add_foreign_key "items", "shops"
  add_foreign_key "shops", "vendor_profiles"
  add_foreign_key "vendor_profiles", "users"
  add_foreign_key "verification_challenges", "users"
end
