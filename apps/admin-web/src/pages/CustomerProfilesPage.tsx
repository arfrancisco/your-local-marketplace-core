import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminCustomerProfile } from '../api/types'

export function CustomerProfilesPage() {
  const [profiles, setProfiles] = useState<AdminCustomerProfile[]>([])

  useEffect(() => {
    api.listCustomerProfiles().then((res) => setProfiles(res.customer_profiles))
  }, [])

  return (
    <div className="container">
      <h1>Customer profiles</h1>
      <table>
        <thead><tr><th>ID</th><th>User</th><th>Display name</th><th>Resident</th></tr></thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td><Link to={`/users/${p.user_id}`}>{p.user_email}</Link></td>
              <td>{p.display_name}</td>
              <td>{p.is_resident === null ? '—' : p.is_resident ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
