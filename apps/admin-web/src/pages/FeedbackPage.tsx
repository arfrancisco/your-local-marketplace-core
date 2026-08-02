import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminFeedbackSubmission } from '../api/types'

export function FeedbackPage() {
  const [items, setItems] = useState<AdminFeedbackSubmission[]>([])
  const [resolved, setResolved] = useState('false')

  function refresh() {
    api.listFeedback({ resolved }).then((res) => setItems(res.feedback_submissions))
  }

  useEffect(refresh, [resolved])

  return (
    <div className="container">
      <h1>Feedback</h1>
      <select value={resolved} onChange={(e) => setResolved(e.target.value)}>
        <option value="false">Unresolved</option>
        <option value="true">Resolved</option>
        <option value="">All</option>
      </select>
      <table>
        <thead><tr><th>Message</th><th>Email</th><th>Page</th><th>At</th><th></th></tr></thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id}>
              <td>{f.message}</td>
              <td>{f.email ?? '—'}</td>
              <td>{f.page_url ?? '—'}</td>
              <td>{f.created_at}</td>
              <td>
                {f.resolved ? (
                  <button onClick={() => api.reopenFeedback(f.id).then(refresh)}>Reopen</button>
                ) : (
                  <button onClick={() => api.resolveFeedback(f.id).then(refresh)}>Resolve</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
