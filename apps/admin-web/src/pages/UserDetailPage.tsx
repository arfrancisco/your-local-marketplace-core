import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminUser, AdminAddress, AdminApiToken } from '../api/types'

export function UserDetailPage() {
  const { id } = useParams()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [addresses, setAddresses] = useState<AdminAddress[]>([])
  const [tokens, setTokens] = useState<AdminApiToken[]>([])

  function refresh() {
    if (!id) return
    api.getUser(Number(id)).then((res) => setUser(res.user))
    api.listAddresses({ user_id: Number(id) }).then((res) => setAddresses(res.addresses))
    api.listApiTokens({ user_id: Number(id) }).then((res) => setTokens(res.api_tokens))
  }

  useEffect(refresh, [id])

  if (!user) return <p className="container">Loading…</p>

  return (
    <div className="container">
      <Link to="/users">← Users</Link>
      <h1>{user.email}</h1>
      <p className="muted">Mobile: {user.mobile_number ?? '—'} · Status: {user.status}</p>
      <p>
        {user.status === 'active' ? (
          <button onClick={() => api.suspendUser(user.id).then(refresh)}>Suspend</button>
        ) : (
          <button onClick={() => api.reactivateUser(user.id).then(refresh)}>Reactivate</button>
        )}
      </p>

      {user.vendor_profile && (
        <p>
          Vendor profile: {user.vendor_profile.verification_status} —{' '}
          <Link to="/vendor_profiles">view all vendor profiles</Link>
        </p>
      )}

      <h2>Addresses</h2>
      <table>
        <thead><tr><th>Label</th><th>Tower</th><th>Unit</th><th>City</th></tr></thead>
        <tbody>
          {addresses.map((a) => (
            <tr key={a.id}><td>{a.label}</td><td>{a.building}</td><td>{a.unit}</td><td>{a.city}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>API tokens</h2>
      <table>
        <thead><tr><th>ID</th><th>Expires</th><th>Last used</th><th>Revoked</th><th></th></tr></thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.expires_at ?? '—'}</td>
              <td>{t.last_used_at ?? 'never'}</td>
              <td>{t.revoked ? 'yes' : 'no'}</td>
              <td>{!t.revoked && <button onClick={() => api.revokeApiToken(t.id).then(refresh)}>Revoke</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
