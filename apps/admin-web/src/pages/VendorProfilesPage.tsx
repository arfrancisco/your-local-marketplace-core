import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminVendorProfile } from '../api/types'

export function VendorProfilesPage() {
  const [profiles, setProfiles] = useState<AdminVendorProfile[]>([])
  const [filter, setFilter] = useState('')
  const [demoFilter, setDemoFilter] = useState('')

  function refresh() {
    api
      .listVendorProfiles({
        verification_status: filter || undefined,
        demo: demoFilter === '' ? undefined : demoFilter === 'true',
      })
      .then((res) => setProfiles(res.vendor_profiles))
  }

  useEffect(refresh, [filter, demoFilter])

  return (
    <div className="container">
      <h1>Vendor profiles</h1>
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">All</option>
        <option value="unverified">Unverified</option>
        <option value="pending">Pending</option>
        <option value="verified">Verified</option>
        <option value="rejected">Rejected</option>
      </select>
      <select value={demoFilter} onChange={(e) => setDemoFilter(e.target.value)}>
        <option value="">All</option>
        <option value="true">Demo only</option>
        <option value="false">Real only</option>
      </select>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>User</th><th>Display name</th><th>Status</th><th>Shops</th><th>Demo</th>
            <th>Cancellation restriction</th><th></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td><Link to={`/users/${p.user_id}`}>{p.user_email}</Link></td>
              <td>{p.display_name}</td>
              <td>{p.verification_status}</td>
              <td>{p.shop_count}</td>
              <td>{p.demo && <span className="badge badge-demo">Demo</span>}</td>
              <td>
                {p.cancellation_restricted_at && <span className="badge badge-restricted">Restricted</span>}{' '}
                {p.cancellation_restriction_count > 0 && `flagged ${p.cancellation_restriction_count}×`}
              </td>
              <td>
                <button onClick={() => api.approveVendorProfile(p.id).then(refresh)}>Approve</button>{' '}
                <button onClick={() => api.rejectVendorProfile(p.id).then(refresh)}>Reject</button>{' '}
                {p.cancellation_restricted_at && (
                  <button onClick={() => api.clearVendorCancellationRestriction(p.id).then(refresh)}>
                    Clear restriction
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
