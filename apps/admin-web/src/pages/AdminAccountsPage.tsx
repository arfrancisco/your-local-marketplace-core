import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth'
import type { AdminAccount } from '../api/types'

export function AdminAccountsPage() {
  const { adminAccount: self } = useAuth()
  const [accounts, setAccounts] = useState<AdminAccount[]>([])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function refresh() {
    api.listAdminAccounts({ page: 1 }).then((res) => setAccounts(res.admin_users))
  }

  useEffect(refresh, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.createAdminAccount({
        email,
        password,
        password_confirmation: passwordConfirmation,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      })
      setEmail('')
      setPassword('')
      setPasswordConfirmation('')
      setFirstName('')
      setLastName('')
      refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create admin account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container">
      <h1>Admin accounts</h1>
      <p className="muted">
        Per-admin accounts for this admin panel itself (not marketplace users). Every mutating
        action taken while signed in as one of these is attributed to it on the Audit log page.
      </p>

      <table>
        <thead>
          <tr>
            <th>ID</th><th>Email</th><th>Name</th><th>Status</th><th>Last signed in</th><th>Created</th><th></th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.email}</td>
              <td>{[a.first_name, a.last_name].filter(Boolean).join(' ') || '—'}</td>
              <td>{a.status}</td>
              <td>{a.last_signed_in_at ?? 'never'}</td>
              <td>{a.created_at}</td>
              <td>
                {a.status === 'active' ? (
                  <button
                    disabled={self?.id === a.id}
                    title={self?.id === a.id ? "You can't deactivate your own account" : undefined}
                    onClick={() => api.deactivateAdminAccount(a.id).then(refresh)}
                  >
                    Deactivate
                  </button>
                ) : (
                  <button onClick={() => api.reactivateAdminAccount(a.id).then(refresh)}>Reactivate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add an admin account</h2>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </label>
        <label>
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            required
          />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create admin account'}
        </button>
      </form>
    </div>
  )
}
