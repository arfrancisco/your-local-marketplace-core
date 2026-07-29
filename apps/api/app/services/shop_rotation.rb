# Fair ordering for the community shop listing (ADR 0007). No shop is
# permanently favored: each open shop leads on a predictable, evenly spread set
# of days across the year.
#
#   sort_key = (shop_id + day_of_year) % open_shop_count
#
# Computed per request from the current date — no DB column, no scheduled job.
# Deterministic for a given date (specs freeze time and assert an exact order),
# with shop id as a stable tiebreaker when two keys collide.
class ShopRotation
  def self.order(shops, on: Date.current)
    list = shops.to_a
    count = list.size
    return list if count.zero?

    day = on.yday
    list.sort_by { |shop| [(shop.id + day) % count, shop.id] }
  end
end
