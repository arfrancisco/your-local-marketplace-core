module Messaging
  # Which of a set of orders have messages the given user hasn't read yet,
  # computed in exactly two queries regardless of how many orders are
  # passed in — safe to call from list endpoints (OrdersController#index,
  # Vendor::OrdersController#index), not just single-order ones.
  #
  # "Unread" = there's a message in the order's conversation, not sent by
  # this user, newer (by id) than this user's ConversationRead cursor for
  # that conversation (or any message at all if they've never read it).
  # Status-change system messages count — they're posted by the acting
  # party (see Orders::TransitionStatus), so the OTHER party sees them as
  # unread, never the actor themselves.
  class UnreadOrders
    def self.for(orders:, user:)
      new(orders: orders, user: user).call
    end

    def initialize(orders:, user:)
      @orders = orders.to_a
      @user = user
    end

    def call
      return Set.new if @user.nil? || @orders.empty?

      conversation_ids = @orders.filter_map { |o| o.conversation&.id }
      return Set.new if conversation_ids.empty?

      cursors = ConversationRead.where(user: @user, conversation_id: conversation_ids)
                                 .pluck(:conversation_id, :last_read_message_id).to_h

      # NULL-sender defensive: current data never has one (see plan notes),
      # but "sender_user_id != user.id" alone would silently exclude a NULL
      # sender under SQL's three-valued logic, so it's spelled out.
      latest_other_message_id = Message.where(conversation_id: conversation_ids)
                                        .where("sender_user_id IS NULL OR sender_user_id != ?", @user.id)
                                        .group(:conversation_id)
                                        .maximum(:id)

      @orders.each_with_object(Set.new) do |order, unread|
        conversation = order.conversation
        next if conversation.nil?

        latest_id = latest_other_message_id[conversation.id]
        next if latest_id.nil? # no message from the other party at all

        cursor = cursors[conversation.id]
        unread << order.id if cursor.nil? || latest_id > cursor
      end
    end
  end
end
