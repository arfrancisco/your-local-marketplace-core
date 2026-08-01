import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api/client'
import { getConsumer } from './api/cable'
import type { Message } from './api/types'

const TITLE_FLASH_MS = 1000

// Client-side-only (no service worker, no backend involvement): while the
// tab is hidden, a new message fires a browser Notification and flashes
// document.title, so a customer doesn't miss a vendor reply just because
// this tab isn't focused. Both stop as soon as the tab becomes visible
// again (visibilitychange), and neither fires at all while the tab is
// already in the foreground.
function useChatNotifications() {
  const originalTitleRef = useRef<string | null>(null)
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unreadCountRef = useRef(0)

  // Ask once per mount, only if the user hasn't already answered either way.
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const stopFlashing = useCallback(() => {
    if (flashIntervalRef.current !== null) {
      clearInterval(flashIntervalRef.current)
      flashIntervalRef.current = null
    }
    if (originalTitleRef.current !== null) {
      document.title = originalTitleRef.current
      originalTitleRef.current = null
    }
    unreadCountRef.current = 0
  }, [])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') stopFlashing()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopFlashing()
    }
  }, [stopFlashing])

  const notifyNewMessage = useCallback((message: Message) => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') return

    unreadCountRef.current += 1
    if (originalTitleRef.current === null) originalTitleRef.current = document.title
    if (flashIntervalRef.current === null) {
      let flashed = false
      flashIntervalRef.current = setInterval(() => {
        document.title = flashed ? (originalTitleRef.current ?? document.title) : `(${unreadCountRef.current}) New message`
        flashed = !flashed
      }, TITLE_FLASH_MS)
    }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const preview = message.message_type === 'image' ? 'New photo' : (message.body ?? 'New message').slice(0, 120)
    const notification = new Notification(preview)
    // Only reliable way to bring the tab back into focus from a notification
    // click — requires keeping a reference to it.
    notification.onclick = () => window.focus()
  }, [])

  return { notifyNewMessage }
}

// Real-time per-order chat (ADR 0009). Loads history over REST, then
// subscribes to OrderChatChannel for anything posted after that — including
// the vendor's auto-posted payment message, and now automatic system
// messages posted on every order status change, which arrive as normal
// messages with message_type "system".
export function useOrderChat(orderId: number) {
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const { notifyNewMessage } = useChatNotifications()

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
          let added = false
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev
            added = true
            return [...prev, data]
          })
          // Only notify for genuinely new messages, and only history loaded
          // over REST at mount is exempt — that's not "arriving" in any
          // sense a notification should fire for.
          if (added) notifyNewMessage(data)
        },
      }
    )

    return () => subscription.unsubscribe()
  }, [conversationId, notifyNewMessage])

  async function postMessage(body: string | null, image?: File | null) {
    // No optimistic append — the broadcast (including our own message) comes
    // back over the same channel and is deduped by id above.
    await api.postMessage(orderId, body, image)
  }

  return { messages, loading, postMessage }
}
