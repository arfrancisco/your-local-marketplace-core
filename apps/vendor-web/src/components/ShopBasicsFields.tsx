import type { ReactNode } from 'react'
import type { FulfillmentMethod } from '../api/types'

const METHODS: FulfillmentMethod[] = ['pickup', 'delivery']

export interface ShopBasics {
  name: string
  description: string
  building: string
  address: string
  methods: FulfillmentMethod[]
}

interface ShopBasicsFieldsProps {
  values: ShopBasics
  onChange: (patch: Partial<ShopBasics>) => void
  /** Rendered inside the Name field's `.tour-anchor`, for a tour callout. */
  nameAddon?: ReactNode
  /** Rendered inside the Building field's `.tour-anchor`. */
  buildingAddon?: ReactNode
  /** Rendered inside the fulfillment fieldset's `.tour-anchor`. */
  fulfillmentAddon?: ReactNode
}

/**
 * Name, description, building, unit and fulfillment — the fields that
 * identify a shop. Shared by ShopFormPage (the single-page editor) and the
 * onboarding wizard's first step, so the two can't drift apart.
 */
export function ShopBasicsFields({
  values,
  onChange,
  nameAddon,
  buildingAddon,
  fulfillmentAddon,
}: ShopBasicsFieldsProps) {
  function toggleMethod(method: FulfillmentMethod) {
    onChange({
      methods: values.methods.includes(method)
        ? values.methods.filter((m) => m !== method)
        : [...values.methods, method],
    })
  }

  return (
    <>
      <div className="tour-anchor">
        <label>
          Name
          <input value={values.name} onChange={(e) => onChange({ name: e.target.value })} required />
        </label>
        {nameAddon}
      </div>
      <label>
        Description
        <textarea
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Home-cooked Filipino meals, made to order."
        />
      </label>

      <div className="tour-anchor">
        <label>
          Building / Tower
          <input value={values.building} onChange={(e) => onChange({ building: e.target.value })} required />
          <p className="muted small">
            Shown publicly on your shop page — customers see this, but never your exact unit.
          </p>
        </label>
        {buildingAddon}
      </div>
      <label>
        Unit number (private)
        <input
          value={values.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="e.g. Unit 7A"
        />
        <p className="muted small">
          Never shown to customers browsing your shop. Share it privately in your opening
          message if a customer needs it to pick up or receive a delivery.
        </p>
      </label>

      <div className="tour-anchor">
        <fieldset>
          <legend>How do customers get their order?</legend>
          {METHODS.map((m) => (
            <label key={m} className="inline">
              <input type="checkbox" checked={values.methods.includes(m)} onChange={() => toggleMethod(m)} />
              {m}
            </label>
          ))}
        </fieldset>
        {fulfillmentAddon}
      </div>
    </>
  )
}

/** Appends this group's fields to a shop FormData, in the API's shape. */
export function appendShopBasics(fd: FormData, values: ShopBasics) {
  fd.append('shop[name]', values.name)
  fd.append('shop[description]', values.description)
  fd.append('shop[building]', values.building)
  fd.append('shop[address]', values.address)
  values.methods.forEach((m) => fd.append('shop[fulfillment_methods][]', m))
}
