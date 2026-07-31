import { useEffect, useState } from 'react'
import { api } from './api/client'
import { getConsumer } from './api/cable'
import type { Message } from './api/types'

// Real-time per-order chat (ADR 0009). Loads history over REST, then
// subscribes to OrderChatChannel for anything posted after that — including
// the vendor's auto-posted payment message, which arrives as a normal
// message with message_type "system".
export function useOrderChat(orderId: number) {
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setConversationId(null)
    setMessages([])

    api.getConversation(orderId).then((res) => {
      if (cancelled) return
      setConversationId(res.conversation.id)
      setMessages(res.messages)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [orderId])

  useEffect(() => {
    if (conversationId === null) return

    const consumer = getConsumer()
    const subscription = consumer.subscriptions.create(
      { channel: 'OrderChatChannel', conversation_id: conversationId },
      {
        received(data: Message) {
          setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
        },
      }
    )

    return () => subscription.unsubscribe()
  }, [conversationId])

  async function postMessage(body: string | null, image?: File | null) {
    // No optimistic append — the broadcast (including our own message) comes
    // back over the same channel and is deduped by id above.
    await api.postMessage(orderId, body, image)
  }

  return { messages, loading, postMessage }
}
