import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminApiToken } from '../api/types'

export function ApiTokensPage() {
  const [tokens, setTokens] = useState<AdminApiToken[]>([])

  function refresh() {
    api.listApiTokens().then((res) => setTokens(res.api_tokens))
  }

  useEffect(refresh, [])

  return (
    <div className="container">
      <h1>API tokens</h1>
      <table>
        <thead><tr><th>ID</th><th>User</th><th>Expires</th><th>Last used</th><th>Revoked</th><th></th></tr></thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.user_email}</td>
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
