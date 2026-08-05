module Orders
  # Called from Orders::TransitionStatus#call right after it logs the
  # cancellation's OrderStatusEvent — the single choke point every
  # cancellation passes through. Counts recent cancellations *by this actor*
  # (not just on this profile's orders), so a vendor-initiated cancellation
  # never counts against that order's customer, and vice versa — a
  # :both-role user's two sides stay tracked completely independently.
  #
  # Tier 1 (the first time the threshold is crossed): a temporary,
  # admin-clearable restriction — cancellation_restricted_at is set, and a
  # restricted vendor's shops are all closed. Tier 2 (crossed again after
  # having been cleared once, tracked via the permanent
  # cancellation_restriction_count): escalates to a full account suspension
  # instead, reusing User#status (already enforced at login by
  # Auth::AuthenticateUser) rather than inventing a new "banned" concept.
  class CancellationAbuseCheck
    THRESHOLD = 3
    WINDOW = 14.days

    def initialize(order:, actor_user:)
      @order = order
      @actor_user = actor_user
    end

    def call
      return unless recent_cancellation_count >= THRESHOLD

      profile.update!(cancellation_restriction_count: profile.cancellation_restriction_count + 1)

      if profile.cancellation_restriction_count >= 2
        @actor_user.update!(status: "suspended")
      else
        profile.update!(cancellation_restricted_at: Time.current)
        close_vendor_shops! unless customer_actor?
      end
    end

    private

    # Same comparison TransitionStatus itself uses to tell customer and
    # vendor actors apart.
    def customer_actor?
      @order.customer_profile.user_id == @actor_user.id
    end

    def profile
      @profile ||= customer_actor? ? @order.customer_profile : @order.shop.vendor_profile
    end

    def recent_cancellation_count
      scope = OrderStatusEvent
              .where(to_status: "cancelled", actor_user_id: @actor_user.id)
              .where(created_at: WINDOW.ago..)

      if customer_actor?
        scope.joins(:order).where(orders: { customer_profile_id: profile.id }).count
      else
        scope.joins(order: :shop).where(shops: { vendor_profile_id: profile.id }).count
      end
    end

    def close_vendor_shops!
      profile.shops.each(&:close!)
    end
  end
end
