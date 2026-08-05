import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminCustomerProfile } from '../api/types'

export function CustomerProfilesPage() {
  const [profiles, setProfiles] = useState<AdminCustomerProfile[]>([])
  const [demoFilter, setDemoFilter] = useState('')

  function refresh() {
    api
      .listCustomerProfiles({ demo: demoFilter === '' ? undefined : demoFilter === 'true' })
      .then((res) => setProfiles(res.customer_profiles))
  }

  useEffect(refresh, [demoFilter])

  return (
    <div className="container">
      <h1>Customer profiles</h1>
      <select value={demoFilter} onChange={(e) => setDemoFilter(e.target.value)}>
        <option value="">All</option>
        <option value="true">Demo only</option>
        <option value="false">Real only</option>
      </select>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>User</th><th>Display name</th><th>Resident</th><th>Verified resident</th><th>Demo</th><th>Cancellation restriction</th><th></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td><Link to={`/users/${p.user_id}`}>{p.user_email}</Link></td>
              <td>{p.display_name}</td>
              <td>{p.is_resident === null ? '—' : p.is_resident ? 'yes' : 'no'}</td>
              <td>
                {p.residency_verification_status === 'verified' ? (
                  <span className="badge badge-verified">Verified resident</span>
                ) : (
                  p.residency_verification_status
                )}
              </td>
              <td>{p.demo && <span className="badge badge-demo">Demo</span>}</td>
              <td>
                {p.cancellation_restricted_at && <span className="badge badge-restricted">Restricted</span>}{' '}
                {p.cancellation_restriction_count > 0 && `flagged ${p.cancellation_restriction_count}×`}
              </td>
              <td>
                {p.is_resident === true && p.residency_verification_status !== 'verified' && (
                  <button onClick={() => api.verifyResidency(p.id).then(refresh)}>Verify residency</button>
                )}{' '}
                {p.is_resident === true && p.residency_verification_status !== 'rejected' && (
                  <button onClick={() => api.rejectResidency(p.id).then(refresh)}>Reject residency</button>
                )}{' '}
                {p.cancellation_restricted_at && (
                  <button onClick={() => api.clearCustomerCancellationRestriction(p.id).then(refresh)}>
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
