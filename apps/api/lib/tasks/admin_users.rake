# Bootstrapping and out-of-band token minting for admin accounts. See
# docs/adr/0010-per-admin-accounts.md — after the first AdminUser exists,
# every subsequent one is created self-service via the Admin Users page in
# admin-web (Api::V1::Admin::AdminUsersController), not this rake task.
namespace :admin_users do
  desc "Bootstrap the very first AdminUser from ADMIN_EMAIL/ADMIN_PASSWORD. Aborts if any AdminUser already exists."
  task create: :environment do
    if AdminUser.exists?
      abort "An AdminUser already exists. Use the Admin Users page in admin-web to create additional accounts."
    end

    email = ENV["ADMIN_EMAIL"]
    password = ENV["ADMIN_PASSWORD"]
    abort "Set ADMIN_EMAIL and ADMIN_PASSWORD, e.g.: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... bin/rails admin_users:create" if email.blank? || password.blank?

    admin_user = AdminUser.create!(email: email, password: password)
    puts "Created AdminUser #{admin_user.email} (id=#{admin_user.id})"
  end

  desc "Mint a long-lived AdminApiToken for admin-mcp: bin/rails admin_users:mint_token[email,ttl_days] (ttl_days defaults to 180)"
  task :mint_token, [:email, :ttl_days] => :environment do |_task, args|
    abort "Usage: bin/rails admin_users:mint_token[email,ttl_days]" if args[:email].blank?

    admin_user = AdminUser.find_by("lower(email) = ?", args[:email].to_s.strip.downcase)
    abort "No AdminUser with email #{args[:email]}" if admin_user.nil?

    ttl_days = (args[:ttl_days].presence || 180).to_i
    _record, raw = AdminApiToken.issue!(admin_user, ttl: ttl_days.days)

    puts "Long-lived token for #{admin_user.email} (expires in #{ttl_days} days) — put this in admin-mcp/.env as ADMIN_TOKEN:"
    puts raw
  end
end
