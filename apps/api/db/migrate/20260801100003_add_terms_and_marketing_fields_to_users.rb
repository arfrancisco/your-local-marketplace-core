class AddTermsAndMarketingFieldsToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :terms_accepted_at, :datetime
    add_column :users, :terms_version, :string
    add_column :users, :email_marketing_opt_in, :boolean, null: false, default: false
    add_column :users, :sms_marketing_opt_in, :boolean, null: false, default: false
  end
end
