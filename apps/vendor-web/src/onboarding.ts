// The vendor setup wizard's step list, in order.
//
// Source of truth is `Shop::ONBOARDING_STEPS` in
// apps/api/app/models/shop.rb — `shops.onboarding_step` only ever holds one
// of these strings, and this array must stay in the same order as that one.
// Everything else here is derived: the route path, the "Step N of 4"
// counter, the progress bar's segment count. Nothing anywhere should
// hardcode the number of steps.
export const ONBOARDING_STEPS = ['shop', 'photos', 'items', 'payment'] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

// Short, lower-case fragments — they get dropped into a sentence ("You're
// on step 3 of 4 — add your first item"), not used as headings.
export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  shop: 'tell us about your shop',
  photos: 'add your shop photos',
  items: 'add your first item',
  payment: 'how customers pay you',
}

export function isOnboardingStep(value: string | null | undefined): value is OnboardingStep {
  return ONBOARDING_STEPS.includes(value as OnboardingStep)
}

/** Falls back to the first step for anything unrecognised (or missing). */
export function toOnboardingStep(value: string | null | undefined): OnboardingStep {
  return isOnboardingStep(value) ? value : ONBOARDING_STEPS[0]
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step)
}

/** 1-based, for display. Never assume this tops out at 4. */
export function stepNumber(step: OnboardingStep): number {
  return stepIndex(step) + 1
}

export function stepPath(step: OnboardingStep): string {
  return `/onboarding/${step}`
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[stepIndex(step) - 1] ?? null
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[stepIndex(step) + 1] ?? null
}

/**
 * `onboarding_step` records the *furthest* step reached, not where the
 * vendor currently is — walking Back must never regress it, or resuming
 * later would yank them backward through steps they already passed.
 *
 * The API enforces this too (Shop#keep_onboarding_step_moving_forward), and
 * that is the authority. This only spares us sending a value the server
 * would just clamp anyway.
 */
export function isFurtherThan(candidate: OnboardingStep, reached: OnboardingStep): boolean {
  return stepIndex(candidate) > stepIndex(reached)
}
