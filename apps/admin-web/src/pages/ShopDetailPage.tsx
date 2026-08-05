import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminShop, AdminItem } from '../api/types'

export function ShopDetailPage() {
  const { id } = useParams()
  const [shop, setShop] = useState<AdminShop | null>(null)
  const [items, setItems] = useState<AdminItem[]>([])
  const [itemDemoFilter, setItemDemoFilter] = useState('')

  function refresh() {
    if (!id) return
    api.getShop(Number(id)).then((res) => setShop(res.shop))
    api
      .listItems({ shop_id: Number(id), demo: itemDemoFilter === '' ? undefined : itemDemoFilter === 'true' })
      .then((res) => setItems(res.items))
  }

  useEffect(refresh, [id, itemDemoFilter])

  if (!shop) return <p className="container">Loading…</p>

  return (
    <div className="container">
      <Link to="/shops">← Shops</Link>
      <h1>
        {shop.name}{' '}
        {shop.demo && <span className="badge badge-demo">Demo</span>}{' '}
        {shop.vendor_verification_status === 'verified' && <span className="badge badge-verified">Verified</span>}
      </h1>
      <p className="muted">{shop.description}</p>
      <p>
        Status: {shop.status} · Accepting orders: {shop.accepting_orders ? 'yes' : 'no'}
      </p>
      <p>
        <button onClick={() => api.updateShop(shop.id, { status: 'active' }).then(refresh)}>Set active</button>{' '}
        <button onClick={() => api.updateShop(shop.id, { status: 'suspended' }).then(refresh)}>Suspend</button>{' '}
        <button
          onClick={() => {
            if (confirm(`Delete shop "${shop.name}"? This cannot be undone.`)) {
              api.deleteShop(shop.id).then(() => { window.location.href = '/shops' })
            }
          }}
        >
          Delete
        </button>
      </p>

      {shop.opening_message && (
        <>
          <h2>Opening message</h2>
          <p>{shop.opening_message}</p>
        </>
      )}

      {shop.vendor && (
        <>
          <h2>Vendor & account</h2>
          <table>
            <tbody>
              <tr>
                <th>Vendor profile</th>
                <td>
                  {shop.vendor.display_name}{' '}
                  {shop.vendor.verification_status === 'verified' && (
                    <span className="badge badge-verified">Verified</span>
                  )}
                </td>
              </tr>
              <tr>
                <th>Verification status</th>
                <td>
                  {shop.vendor.verification_status}{' '}
                  {(shop.vendor.verification_status === 'unverified' || shop.vendor.verification_status === 'pending') && (
                    <button onClick={() => api.approveVendorProfile(shop.vendor!.id).then(refresh)}>Approve</button>
                  )}{' '}
                  {shop.vendor.verification_status !== 'rejected' && (
                    <button onClick={() => api.rejectVendorProfile(shop.vendor!.id).then(refresh)}>Reject</button>
                  )}
                </td>
              </tr>
              <tr>
                <th>Vendor since</th>
                <td>{shop.vendor.created_at}</td>
              </tr>
              <tr>
                <th>Cancellation restriction</th>
                <td>
                  {shop.vendor.cancellation_restricted_at && <span className="badge badge-restricted">Restricted</span>}{' '}
                  {shop.vendor.cancellation_restriction_count > 0 && `flagged ${shop.vendor.cancellation_restriction_count}×`}{' '}
                  {shop.vendor.cancellation_restricted_at && (
                    <button onClick={() => api.clearVendorCancellationRestriction(shop.vendor!.id).then(refresh)}>
                      Clear restriction
                    </button>
                  )}
                </td>
              </tr>
              <tr>
                <th>User</th>
                <td>
                  <Link to={`/users/${shop.vendor.user.id}`}>{shop.vendor.user.email}</Link>{' '}
                  {shop.vendor.user.demo && <span className="badge badge-demo">Demo</span>}
                </td>
              </tr>
              <tr>
                <th>Mobile</th>
                <td>{shop.vendor.user.mobile_number ?? '—'}</td>
              </tr>
              <tr>
                <th>Account status</th>
                <td>{shop.vendor.user.status}</td>
              </tr>
              <tr>
                <th>Email / mobile verified</th>
                <td>
                  {shop.vendor.user.email_verified ? 'yes' : '—'} / {shop.vendor.user.mobile_verified ? 'yes' : '—'}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted">
            <Link to="/vendor_profiles">All vendor profiles</Link> · <Link to={`/users/${shop.vendor.user.id}`}>Full user record</Link>
          </p>
        </>
      )}

      <h2>Items</h2>
      <select value={itemDemoFilter} onChange={(e) => setItemDemoFilter(e.target.value)}>
        <option value="">All</option>
        <option value="true">Demo only</option>
        <option value="false">Real only</option>
      </select>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Enabled</th><th>Stock</th><th>Demo</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td><Link to={`/items/${i.id}`}>{i.id}</Link></td>
              <td>{i.name}</td>
              <td>{(i.price_cents / 100).toFixed(2)} {i.currency}</td>
              <td>{i.enabled ? 'yes' : 'no'}</td>
              <td>{i.stock_count ?? '—'}{i.sold_out ? ' (sold out)' : ''}</td>
              <td>{i.demo && <span className="badge badge-demo">Demo</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
