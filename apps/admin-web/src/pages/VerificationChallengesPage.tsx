import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminVerificationChallenge } from '../api/types'

export function VerificationChallengesPage() {
  const [challenges, setChallenges] = useState<AdminVerificationChallenge[]>([])

  useEffect(() => {
    api.listVerificationChallenges().then((res) => setChallenges(res.verification_challenges))
  }, [])

  return (
    <div className="container">
      <h1>Verification challenges</h1>
      <p className="muted">Audit only — codes are never shown or editable here.</p>
      <table>
        <thead><tr><th>User</th><th>Channel</th><th>Purpose</th><th>Sent to</th><th>Consumed</th><th>Expired</th><th>Attempts</th></tr></thead>
        <tbody>
          {challenges.map((c) => (
            <tr key={c.id}>
              <td>{c.user_id}</td>
              <td>{c.channel}</td>
              <td>{c.purpose}</td>
              <td>{c.sent_to}</td>
              <td>{c.consumed ? 'yes' : 'no'}</td>
              <td>{c.expired ? 'yes' : 'no'}</td>
              <td>{c.attempts_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
