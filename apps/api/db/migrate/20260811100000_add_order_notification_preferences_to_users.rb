class AddOrderNotificationPreferencesToUsers < ActiveRecord::Migration[8.1]
  def change
    # Default true (opt-out, not opt-in) — matches the baseline "verified
    # mobile is enough" consent decision. sms_notify_order_ready covers both
    # ready_for_pickup and out_for_delivery (same "your order is moving"
    # moment, one shared toggle — see Orders::TransitionStatus).
    add_column :users, :sms_notify_order_placed, :boolean, default: true, null: false
    add_column :users, :sms_notify_order_accepted, :boolean, default: true, null: false
    add_column :users, :sms_notify_order_ready, :boolean, default: true, null: false
    add_column :users, :sms_notify_order_completed, :boolean, default: true, null: false
  end
end
