require "rails_helper"

RSpec.describe Shop, type: :model do
  subject { build(:shop) }

  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to belong_to(:vendor_profile) }

  describe "one shop per vendor" do
    it "rejects a second shop for a vendor who already has one" do
      profile = create(:shop).vendor_profile
      second = build(:shop, vendor_profile: profile)

      expect(second).not_to be_valid
      expect(second.errors[:vendor_profile_id]).to be_present
    end
  end

  describe "demo/real derivation" do
    it "delegates to the owning vendor's user" do
      demo_shop = create(:shop, vendor_profile: create(:vendor_profile, user: create(:user, :demo)))
      real_shop = create(:shop)

      expect(demo_shop).to be_demo
      expect(real_shop).not_to be_demo
      expect(Shop.demo).to contain_exactly(demo_shop)
      expect(Shop.real).to contain_exactly(real_shop)
    end
  end

  describe "slug generation" do
    it "derives a slug from the name at creation" do
      shop = create(:shop, name: "Corner Kitchen")
      expect(shop.slug).to eq("corner-kitchen")
    end

    it "disambiguates a colliding slug with a numeric suffix" do
      create(:shop, name: "Corner Kitchen")
      second = create(:shop, name: "Corner Kitchen")
      expect(second.slug).to eq("corner-kitchen-2")
    end

    it "does not change the slug when the name later changes" do
      shop = create(:shop, name: "Corner Kitchen")
      shop.update!(name: "Renamed Kitchen")
      expect(shop.slug).to eq("corner-kitchen")
    end
  end

  describe "building (tower)" do
    it "allows a blank building — publishing it is optional for a vendor" do
      expect(build(:shop, building: "")).to be_valid
      expect(build(:shop, building: nil)).to be_valid
    end
  end

  describe "fulfillment methods" do
    it "requires at least one method" do
      shop = build(:shop, fulfillment_methods: [])
      expect(shop).not_to be_valid
      expect(shop.errors[:fulfillment_methods]).to be_present
    end

    it "rejects an unsupported method" do
      expect(build(:shop, fulfillment_methods: %w[teleport])).not_to be_valid
    end

    it "accepts pickup and delivery together" do
      expect(build(:shop, fulfillment_methods: %w[pickup delivery])).to be_valid
    end
  end

  describe "onboarding" do
    it "starts a brand-new shop at the first step, not complete" do
      shop = create(:shop)

      expect(shop.onboarding_step).to eq(Shop::ONBOARDING_STEPS.first)
      expect(shop.onboarding_step).to eq("shop")
      expect(shop).not_to be_onboarding_complete
    end

    it "treats a shop with a completion timestamp as complete" do
      expect(build(:shop, onboarding_completed_at: Time.current)).to be_onboarding_complete
    end

    it "accepts every canonical step" do
      Shop::ONBOARDING_STEPS.each do |step|
        expect(build(:shop, onboarding_step: step)).to be_valid
      end
    end

    it "rejects a step outside the canonical list" do
      shop = build(:shop, onboarding_step: "banking")

      expect(shop).not_to be_valid
      expect(shop.errors[:onboarding_step]).to be_present
    end

    # The AddOnboardingToShops backfill exists so shops that predate the wizard
    # are never sent back into it. Asserting the resulting state rather than
    # re-running the migration: what matters is that an already-backfilled row
    # reads as complete and parked on the last step.
    it "reads a backfilled pre-wizard shop as complete and parked on the last step" do
      shop = create(:shop)
      shop.update_columns(onboarding_completed_at: shop.created_at,
                          onboarding_step: Shop::ONBOARDING_STEPS.last)

      expect(shop.reload).to be_onboarding_complete
      expect(shop.onboarding_completed_at).to be_within(1.second).of(shop.created_at)
      expect(shop.onboarding_step).to eq("payment")
    end
  end

  describe "open/close" do
    it "opening activates the shop and accepts orders" do
      shop = create(:shop, :ready_to_open)
      shop.open!
      expect(shop).to be_open
      expect(shop.status).to eq("active")
    end

    it "refuses to open without an opening message — it is how customers pay (ADR 0009)" do
      shop = create(:shop, :with_item, opening_message: nil)

      expect { shop.open! }
        .to raise_error(ApiError) { |e| expect(e.code).to eq("opening_message_required") }
      expect(shop.reload.status).to eq("draft")
    end

    it "refuses to open with no enabled item — an empty shop wastes a rotation slot" do
      shop = create(:shop, opening_message: "GCash to 0917 123 4567.")

      expect { shop.open! }
        .to raise_error(ApiError) { |e| expect(e.code).to eq("no_enabled_items") }
      expect(shop.reload.status).to eq("draft")
    end

    it "does not count a disabled item toward the catalog requirement" do
      shop = create(:shop, opening_message: "GCash to 0917 123 4567.")
      create(:item, shop: shop, enabled: false)

      expect { shop.open! }.to raise_error(ApiError) { |e| expect(e.code).to eq("no_enabled_items") }
    end

    it "does not count an archived item toward the catalog requirement" do
      shop = create(:shop, opening_message: "GCash to 0917 123 4567.")
      create(:item, shop: shop, enabled: true, archived_at: Time.current)

      expect { shop.open! }.to raise_error(ApiError) { |e| expect(e.code).to eq("no_enabled_items") }
    end

    it "closing stops accepting orders" do
      shop = create(:shop, :open)
      shop.close!
      expect(shop).not_to be_open
      expect(shop.accepting_orders).to be(false)
    end

    # The dashboard shows these to explain why a shop cannot open, so they
    # have to stay in lockstep with what open! actually refuses on. Same
    # source, checked from both directions.
    describe "#open_blockers" do
      it "reports both reasons for a bare shop, in the order to fix them" do
        shop = create(:shop)
        expect(shop.open_blockers).to eq(%w[opening_message_required no_enabled_items])
        expect(shop).not_to be_ready_to_open
      end

      it "drops a reason once it is satisfied" do
        shop = create(:shop, opening_message: "GCash to 0917-000-0000.")
        expect(shop.open_blockers).to eq(%w[no_enabled_items])
      end

      it "is empty for a shop that can actually open, and open! then succeeds" do
        shop = create(:shop, :ready_to_open)
        expect(shop.open_blockers).to be_empty
        expect(shop).to be_ready_to_open
        expect { shop.open! }.not_to raise_error
      end

      it "refuses open! with the same message it reports as a blocker" do
        shop = create(:shop)
        expect { shop.open! }.to raise_error(ApiError) { |e|
          expect(e.message).to eq(Shop::OPEN_BLOCKERS.fetch(shop.open_blockers.first))
        }
      end

      it "does not count a disabled or archived item toward readiness" do
        shop = create(:shop, opening_message: "GCash to 0917-000-0000.")
        create(:item, shop: shop, enabled: false)
        create(:item, shop: shop, archived_at: Time.current)
        expect(shop.open_blockers).to eq(%w[no_enabled_items])
      end

      it "reads a preloaded :items association instead of querying again" do
        shop = create(:shop, :ready_to_open)
        preloaded = Shop.includes(:items).find(shop.id)
        expect(preloaded.items).to be_loaded

        queries = 0
        counter = ->(*, payload) { queries += 1 unless payload[:name] == "SCHEMA" || payload[:cached] }
        # .exists? would issue SQL here even though the rows are already in
        # memory, which is one extra query per row on the admin shop list.
        ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
          preloaded.open_blockers
        end

        expect(queries).to eq(0)
      end

      it "still sees a disabled item correctly when :items is preloaded" do
        shop = create(:shop, opening_message: "GCash to 0917-000-0000.")
        create(:item, shop: shop, enabled: false)
        preloaded = Shop.includes(:items).find(shop.id)

        expect(preloaded.open_blockers).to eq(%w[no_enabled_items])
      end

      # A cancellation-abuse restriction is checked by open! separately and
      # first, and deliberately does NOT appear here: it is an admin penalty
      # the vendor cannot act on, so it stays a reactive error rather than a
      # permanent dashboard card. Pinning the boundary so it stays a decision.
      it "omits a cancellation restriction, which open! still refuses on" do
        restricted = create(:vendor_profile, cancellation_restricted_at: Time.current)
        shop = create(:shop, :ready_to_open, vendor_profile: restricted)

        expect(shop.open_blockers).to be_empty
        expect(shop).to be_ready_to_open
        expect { shop.open! }.to raise_error(ApiError) { |e|
          expect(e.code).to eq("cancellation_restricted")
        }
      end

      # Both facts in one place: the setup work is still reported, and the
      # restriction still wins, so the precedence is readable without
      # inferring it from two tests that each show half.
      it "reports setup work while a restriction takes precedence in open!" do
        restricted = create(:vendor_profile, cancellation_restricted_at: Time.current)
        shop = create(:shop, vendor_profile: restricted)

        expect(shop.open_blockers).to eq(%w[opening_message_required no_enabled_items])
        expect { shop.open! }.to raise_error(ApiError) { |e|
          expect(e.code).to eq("cancellation_restricted")
        }
      end
    end

    # The migration backfills every pre-wizard shop as complete, including
    # abandoned signups that never got an item or an opening message. Those
    # shops are done with the wizard but still cannot open, which is exactly
    # the state the dashboard's readiness card exists to explain.
    it "can be onboarding-complete and still blocked from opening" do
      shop = create(:shop)
      shop.update!(onboarding_completed_at: shop.created_at)

      expect(shop).to be_onboarding_complete
      expect(shop).not_to be_ready_to_open
      expect { shop.open! }.to raise_error(ApiError)
    end

    it "lists only active, accepting shops" do
      open_shop = create(:shop, :open)
      create(:shop) # draft
      expect(Shop.listed).to contain_exactly(open_shop)
    end

    it "refuses to open when the owning vendor is under a cancellation-abuse restriction" do
      restricted_vendor = create(:vendor_profile, cancellation_restricted_at: Time.current)
      shop = create(:shop, vendor_profile: restricted_vendor)

      expect { shop.open! }
        .to raise_error(ApiError) { |e| expect(e.code).to eq("cancellation_restricted"); expect(e.status).to eq(:forbidden) }
      expect(shop.reload.status).to eq("draft")
    end
  end
end
