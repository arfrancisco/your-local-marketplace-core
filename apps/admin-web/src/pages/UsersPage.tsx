import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminUser } from '../api/types'

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')

  function refresh() {
    api.listUsers({ q: q || undefined }).then((res) => setUsers(res.users))
  }

  useEffect(refresh, [q])

  return (
    <div className="container">
      <h1>Users</h1>
      <input placeholder="Search email/mobile" value={q} onChange={(e) => setQ(e.target.value)} />
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Email</th><th>Mobile</th><th>Status</th><th>Customer</th><th>Vendor</th><th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><Link to={`/users/${u.id}`}>{u.id}</Link></td>
              <td>{u.email}</td>
              <td>{u.mobile_number ?? '—'}</td>
              <td>{u.status}</td>
              <td>{u.customer_profile ? 'yes' : '—'}</td>
              <td>{u.vendor_profile ? u.vendor_profile.verification_status : '—'}</td>
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
