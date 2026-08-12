# Sends an SMS nudge for one order-lifecycle transition, enqueued by
# Orders::TransitionStatus (accepted/ready_for_pickup/out_for_delivery/
# completed) and Carts::Checkout (placed).
#
# Keyed off a specific OrderStatusEvent row (order_status_event_id) rather
# than (order_id, event) or a live `order.status` check — that's deliberate,
# not an oversight. A fast-moving order (e.g. ready_for_pickup then completed
# in quick succession) could legitimately advance past `event` before this
# job runs; guarding on live status would then silently drop the *earlier*
# notification instead of sending it. Deriving both `order` and `event` from
# the historical event row means this always knows exactly which transition
# it's notifying about, regardless of what the order has done since.
# Combined with the row lock in Orders::TransitionStatus (which prevents a
# duplicate event row from a concurrent double-transition), this closes both
# failure modes without a `notified_at` column — deliberately not chasing the
# much rarer "worker killed mid-send, Sidekiq redelivers" case, since the
# worst outcome there is a duplicate text, not a dropped one (consistent with
# the risk already accepted for RatingReminderJob/VerificationDeliveryJob).
class OrderNotificationJob < ApplicationJob
  queue_as :default

  # KapitMarket's other user-facing copy (this app's name, not "KapitMarket
  # PH") — deliberately different from the existing OTP message's
  # "KapitMarket PH" prefix, which is live/shipped/out of scope here.
  MESSAGE_PREFIX = "KapitMarket".freeze

  def perform(order_status_event_id)
    event_row = OrderStatusEvent.find_by(id: order_status_event_id)
    return if event_row.nil?

    order = event_row.order
    event = event_row.to_status

    recipient, audience = recipient_and_audience(order: order, event: event)
    return if recipient.mobile_number.blank?
    return unless recipient.notifies_for?(event)

    code = ShortLink.for(order: order, audience: audience).code
    url = "#{base_url}/s/#{code}"

    Semaphore::Client.send_message(number: recipient.mobile_number, text: message_for(event: event, order: order, url: url))
  end

  private

  def recipient_and_audience(order:, event:)
    if event == "placed"
      [order.shop.vendor_profile.user, "vendor"]
    else
      [order.customer_profile.user, "customer"]
    end
  end

  def message_for(event:, order:, url:)
    ref = order.public_reference.delete_prefix("ORD-")

    case event
    when "placed"
      "#{MESSAGE_PREFIX}: New order from #{customer_short_name(order)} (#{ref})! " \
        "Please review, accept/reject, and arrange payment: #{url}"
    when "accepted"
      "#{MESSAGE_PREFIX}: Your order from #{shop_name(order)} (#{ref}) was accepted! " \
        "Message the vendor to coordinate: #{url}"
    when "ready_for_pickup"
      "#{MESSAGE_PREFIX}: Your order from #{shop_name(order)} (#{ref}) is ready for pickup! " \
        "Message the vendor for details: #{url}"
    when "out_for_delivery"
      "#{MESSAGE_PREFIX}: Your order from #{shop_name(order)} (#{ref}) is out for delivery! " \
        "Message the vendor if needed: #{url}"
    when "completed"
      "#{MESSAGE_PREFIX}: Your order from #{shop_name(order)} (#{ref}) is complete! " \
        "Please rate your experience: #{url}"
    end
  end

  # Structured first_name/last_name from registration, not parsed out of a
  # free-text display name. "Maria S." — falls back to first name alone if
  # last_name is blank.
  def customer_short_name(order)
    user = order.customer_profile.user
    last_initial = user.last_name.present? ? " #{user.last_name[0]}." : ""
    "#{user.first_name}#{last_initial}"
  end

  # SMS-text-only truncation — the real shop name is never mutated/persisted.
  # Shop names can run long (creative pun names are a project convention);
  # this keeps every message in one SMS segment regardless. Plain ASCII
  # "..." deliberately, not "…" (U+2026) — a single non-GSM-7 character
  # forces the whole message into UCS-2 encoding, which cuts segment
  # capacity from 160 chars to 70 and would triple the SMS cost for exactly
  # the long-name case this is meant to handle cheaply. Truncated to 17, not
  # 20, so the "..." suffix keeps the total near the original budget.
  def shop_name(order)
    name = order.shop.name
    name.length > 20 ? "#{name[0, 17]}..." : name
  end

  # A separately-set env var for the same value as CORS_ORIGINS' first entry
  # would be a drift risk if the production domain ever changes again (it
  # already has once). Falls back to the hardcoded production URL only if
  # both are blank (local/test).
  def base_url
    ENV.fetch("APP_BASE_URL") do
      ENV.fetch("CORS_ORIGINS", "").split(",").first.presence || "https://prisma.kapitmarket.ph"
    end
  end
end
