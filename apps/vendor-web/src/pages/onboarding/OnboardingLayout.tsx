import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import type { Item, Photo, Shop } from '../../api/types'
import { SetupProgress } from '../../components/SetupProgress'
import { ShopPreview } from '../../components/ShopPreview'
import type { ShopBasics } from '../../components/ShopBasicsFields'
import { useMyShopState } from '../../useMyShop'
import {
  ONBOARDING_STEPS,
  previousStep,
  stepIndex,
  stepNumber,
  stepPath,
  toOnboardingStep,
  type OnboardingStep,
} from '../../onboarding'

export const EMPTY_BASICS: ShopBasics = {
  name: '',
  description: '',
  building: '',
  address: '',
  methods: ['pickup'],
}

// What the live preview renders against before the shop exists at all (the
// first step, mid-typing). Every field the vendor has actually filled in is
// merged over this.
const DRAFT_SHOP: Shop = {
  id: 0,
  name: '',
  slug: '',
  description: null,
  building: null,
  fulfillment_methods: [],
  status: 'draft',
  accepting_orders: false,
  open: false,
  profile_photo: null,
  cover_photo: null,
  average_rating: null,
  ratings_count: 0,
  created_at: '',
  updated_at: '',
  demo: false,
  verified: false,
}

// A cropped-but-not-yet-uploaded image, shaped like the Photo the API would
// eventually return. ShopPreview passes blob: URLs through untouched.
function draftPhoto(url: string): Photo {
  return { id: -1, url, filename: '', byte_size: 0, content_type: 'image/*' }
}

export interface OnboardingDraft {
  basics: ShopBasics
  profilePreviewUrl: string | null
  coverPreviewUrl: string | null
}

export interface OnboardingContextValue {
  /** null only on the first step, before the shop has been created. */
  shop: Shop | null
  /** Live inventory, including anything added from the Inventory tab
   * mid-onboarding (the bottom tab bar stays usable throughout). */
  items: Item[]
  itemsLoading: boolean
  addItem: (item: Item) => void
  draft: OnboardingDraft
  updateDraft: (patch: Partial<OnboardingDraft>) => void
  /**
   * Saves this step and moves to `target`: creates the shop when there
   * isn't one yet, PATCHes it after that, and records `target` in
   * `onboarding_step` when it is further than what's already recorded.
   * Pass a form only when there is something to save — "Skip for now"
   * passes nothing, which keeps it to at most the progress bookkeeping.
   * Going Back never calls this, so the furthest step reached only ever
   * moves forward. Throws on failure so the step can show the message.
   */
  saveAndAdvance: (target: OnboardingStep, form?: FormData) => Promise<void>
}

export function useOnboarding(): OnboardingContextValue {
  return useOutletContext<OnboardingContextValue>()
}

function ChevronIcon({ up }: { up?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The live "how neighbors will see it" preview, collapsed by default at
 * every width — there is no separate desktop layout that opens it. It reads
 * the in-progress form values merged over the saved shop, so typing a name
 * changes the preview without saving anything.
 */
function OnboardingPreviewAccordion() {
  const { shop, items, draft } = useOnboarding()
  const [open, setOpen] = useState(false)

  const previewShop: Shop = {
    ...(shop ?? DRAFT_SHOP),
    name: draft.basics.name || shop?.name || 'Your shop',
    description: draft.basics.description || null,
    building: draft.basics.building || null,
    fulfillment_methods: draft.basics.methods,
    profile_photo: draft.profilePreviewUrl ? draftPhoto(draft.profilePreviewUrl) : shop?.profile_photo ?? null,
    cover_photo: draft.coverPreviewUrl ? draftPhoto(draft.coverPreviewUrl) : shop?.cover_photo ?? null,
  }

  return (
    <div className="card onboarding-preview">
      <button
        type="button"
        className="onboarding-preview-toggle"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{open ? 'Hide preview' : 'Preview your shop'}</span>
        <ChevronIcon up={open} />
      </button>
      {open && (
        <div className="onboarding-preview-body">
          <p className="muted small">How neighbors will see it</p>
          <ShopPreview shop={previewShop} items={items.filter((item) => item.enabled && !item.archived)} />
        </div>
      )}
    </div>
  )
}

/**
 * The shared frame every wizard step renders inside: heading, intro, the
 * step's own fields, then the preview accordion above the actions (which is
 * where the mockups put it), and finally the Back link.
 */
export function OnboardingStepShell({
  step,
  heading,
  intro,
  children,
  actions,
  footnote,
  error,
}: {
  step: OnboardingStep
  heading: string
  intro: ReactNode
  children: ReactNode
  actions: ReactNode
  footnote?: ReactNode
  error?: string | null
}) {
  const back = previousStep(step)

  return (
    <div className="onboarding-step">
      <div className="onboarding-step-head">
        <h1>{heading}</h1>
        <p className="muted">{intro}</p>
      </div>

      <div className="card onboarding-step-fields">{children}</div>

      <OnboardingPreviewAccordion />

      {error && <p role="alert" className="error">{error}</p>}

      <div className="onboarding-actions">{actions}</div>
      {footnote && <p className="muted small onboarding-footnote">{footnote}</p>}

      {/* Only past the first step — there is nothing behind step 1 but the
          splash. Back is a plain link on purpose: it saves nothing, so it
          can't drag the recorded furthest step backward. */}
      {back && (
        <p className="back-link onboarding-back">
          <Link to={stepPath(back)}>← Back</Link>
        </p>
      )}
    </div>
  )
}

/**
 * The 4-step vendor setup wizard's frame: the progress bar, the guard that
 * keeps anyone from landing mid-wizard without a shop, and the shared state
 * every step reads (the shop itself, its items, and the in-progress form
 * values the live preview renders from).
 *
 * The bottom tab bar deliberately stays visible throughout — a vendor can
 * duck into Inventory mid-setup and come back, and the items step picks up
 * anything they added there.
 */
export function OnboardingLayout() {
  const { shop, loading, setShop } = useMyShopState()
  const location = useLocation()
  const navigate = useNavigate()
  const currentStep = toOnboardingStep(location.pathname.split('/').filter(Boolean).pop())

  const [items, setItems] = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [draft, setDraft] = useState<OnboardingDraft>({
    basics: EMPTY_BASICS,
    profilePreviewUrl: null,
    coverPreviewUrl: null,
  })
  // Seed the form values from the saved shop exactly once, when it first
  // arrives — re-seeding on every shop update (each step PATCHes) would
  // overwrite whatever the vendor is typing right now.
  const seeded = useRef(false)

  useEffect(() => {
    if (!shop || seeded.current) return
    seeded.current = true
    setDraft((prev) => ({
      ...prev,
      basics: {
        name: shop.name,
        description: shop.description ?? '',
        building: shop.building ?? '',
        address: shop.address ?? '',
        methods: shop.fulfillment_methods,
      },
    }))
  }, [shop])

  const shopId = shop?.id
  useEffect(() => {
    if (!shopId) return
    setItemsLoading(true)
    let cancelled = false
    api
      .listItems(shopId)
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch(() => {
        // Best-effort, matching this app's other background reads — an
        // empty list just means the items step says "add your first".
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shopId])

  async function saveAndAdvance(target: OnboardingStep, form?: FormData) {
    const fd = form ?? new FormData()
    // The furthest step reached, never where the vendor currently is: a
    // target behind what's already recorded is left alone, so walking Back
    // and forward again can't yank a resuming vendor backward.
    const records = stepIndex(target) > stepIndex(toOnboardingStep(shop?.onboarding_step))
    if (records) fd.append('shop[onboarding_step]', target)

    if (!shop) {
      const res = await api.createShop(fd)
      setShop(res.shop)
    } else if (form || records) {
      // Nothing to save and nothing new to record (someone stepping
      // forward over ground they already covered) — skip the request.
      const res = await api.updateShop(shop.id, fd)
      setShop(res.shop)
    }
    navigate(stepPath(target))
  }

  if (loading) return <p>Loading your shop…</p>
  // Nothing past the first step can do anything without a shop to attach it
  // to — a direct link or a refresh mid-wizard lands on step 1 instead of a
  // broken page.
  if (!shop && currentStep !== ONBOARDING_STEPS[0]) return <Navigate to={stepPath(ONBOARDING_STEPS[0])} replace />

  const context: OnboardingContextValue = {
    shop,
    items,
    itemsLoading,
    addItem: (item) => setItems((prev) => [...prev, item]),
    draft,
    updateDraft: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
    saveAndAdvance,
  }

  return (
    <div className="onboarding-wizard">
      <SetupProgress step={stepNumber(currentStep)} total={ONBOARDING_STEPS.length} />
      <Outlet context={context} />
    </div>
  )
}
