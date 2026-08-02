import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AdminConversation } from '../api/types'

export function ConversationDetailPage() {
  const { id } = useParams()
  const [conversation, setConversation] = useState<AdminConversation | null>(null)

  useEffect(() => {
    if (id) api.getConversation(Number(id)).then((res) => setConversation(res.conversation))
  }, [id])

  if (!conversation) return <p className="container">Loading…</p>

  return (
    <div className="container">
      <h1>Conversation for order #{conversation.order_id}</h1>
      <table>
        <thead><tr><th>Type</th><th>Sender</th><th>Body</th><th>At</th></tr></thead>
        <tbody>
          {conversation.messages.map((m) => (
            <tr key={m.id}>
              <td>{m.message_type}</td>
              <td>{m.sender_user_id ?? 'system'}</td>
              <td>{m.body}</td>
              <td>{m.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
