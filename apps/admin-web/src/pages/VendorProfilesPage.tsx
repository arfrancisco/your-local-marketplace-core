import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminVendorProfile } from '../api/types'

export function VendorProfilesPage() {
  const [profiles, setProfiles] = useState<AdminVendorProfile[]>([])
  const [filter, setFilter] = useState('')

  function refresh() {
    api.listVendorProfiles({ verification_status: filter || undefined }).then((res) => setProfiles(res.vendor_profiles))
  }

  useEffect(refresh, [filter])

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
      <table>
        <thead><tr><th>ID</th><th>User</th><th>Display name</th><th>Status</th><th>Shops</th><th></th></tr></thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td><Link to={`/users/${p.user_id}`}>{p.user_email}</Link></td>
              <td>{p.display_name}</td>
              <td>{p.verification_status}</td>
              <td>{p.shop_count}</td>
              <td>
                <button onClick={() => api.approveVendorProfile(p.id).then(refresh)}>Approve</button>{' '}
                <button onClick={() => api.rejectVendorProfile(p.id).then(refresh)}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
