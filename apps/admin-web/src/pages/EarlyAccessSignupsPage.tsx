import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminEarlyAccessSignup } from '../api/types'

export function EarlyAccessSignupsPage() {
  const [signups, setSignups] = useState<AdminEarlyAccessSignup[]>([])

  function refresh() {
    api.listEarlyAccessSignups().then((res) => setSignups(res.early_access_signups))
  }

  useEffect(refresh, [])

  return (
    <div className="container">
      <h1>Early access signups</h1>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Interest</th><th></th></tr></thead>
        <tbody>
          {signups.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.email ?? '—'}</td>
              <td>{s.mobile_number ?? '—'}</td>
              <td>{s.interest}</td>
              <td>
                <button
                  onClick={() => {
                    if (confirm('Delete this signup?')) api.deleteEarlyAccessSignup(s.id).then(refresh)
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
