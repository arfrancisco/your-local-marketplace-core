import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminUser } from '../api/types'

// display_name is set on every customer/vendor profile at registration
// (defaulting to the email's local part if the user didn't provide one, see
// Auth::RegisterUser#default_display_name), so this is reliably non-blank —
// first_name/last_name aren't set until later (Customers::CompleteProfile),
// so they're a poor primary choice. Falls back to email only for the
// theoretical case of a user with neither profile type.
function displayNameFor(u: AdminUser): string {
  return u.customer_profile?.display_name || u.vendor_profile?.display_name || u.email
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [demoFilter, setDemoFilter] = useState('')

  function refresh() {
    api
      .listUsers({ q: q || undefined, demo: demoFilter === '' ? undefined : demoFilter === 'true' })
      .then((res) => setUsers(res.users))
  }

  useEffect(refresh, [q, demoFilter])

  return (
    <div className="container">
      <h1>Users</h1>
      <input placeholder="Search email/mobile" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={demoFilter} onChange={(e) => setDemoFilter(e.target.value)}>
        <option value="">All</option>
        <option value="true">Demo only</option>
        <option value="false">Real only</option>
      </select>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Name</th><th>Mobile</th><th>Status</th><th>Email verified</th><th>Mobile verified</th><th>Customer</th><th>Vendor</th><th>Demo</th><th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><Link to={`/users/${u.id}`}>{u.id}</Link></td>
              <td><Link to={`/users/${u.id}`}>{displayNameFor(u)}</Link></td>
              <td>{u.mobile_number ?? '—'}</td>
              <td>{u.status}</td>
              <td>{u.email_verified ? 'yes' : '—'}</td>
              <td>{u.mobile_verified ? 'yes' : '—'}</td>
              <td>{u.customer_profile ? 'yes' : '—'}</td>
              <td>{u.vendor_profile ? u.vendor_profile.verification_status : '—'}</td>
              <td>{u.demo && <span className="badge badge-demo">Demo</span>}</td>
              <td>
                {u.status === 'active' ? (
                  <button onClick={() => api.suspendUser(u.id).then(refresh)}>Suspend</button>
                ) : (
                  <button onClick={() => api.reactivateUser(u.id).then(refresh)}>Reactivate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
