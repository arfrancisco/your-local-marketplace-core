import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderChat } from './OrderChat'
import type { Message } from './api/types'

const { messages } = vi.hoisted(() => ({
  messages: [
    {
      id: 1, conversation_id: 1, sender_user_id: 5, message_type: 'text',
      body: 'Hi, is the adobo still available?', image: null, created_at: '2026-08-01T00:00:00Z', edited_at: null,
    },
    {
      id: 2, conversation_id: 1, sender_user_id: null, message_type: 'system',
      body: 'Order accepted by the vendor.', image: null, created_at: '2026-08-01T00:01:00Z', edited_at: null,
    },
  ] as Message[],
}))

// The ActionCable subscription / notification logic lives in useOrderChat —
// out of scope here, this is purely about how OrderChat renders a
// message_type: "system" entry (auto-posted on every order status change).
vi.mock('./useOrderChat', () => ({
  useOrderChat: () => ({ messages, loading: false, postMessage: vi.fn() }),
}))

describe('OrderChat message rendering', () => {
  it('renders a system message as a plain centered log line, distinct from own or the other party\'s bubbles', () => {
    render(<OrderChat orderId={1} currentUserId={5} />)

    const ownText = screen.getByText('Hi, is the adobo still available?')
    const ownBubble = ownText.closest('.message')!
    expect(ownBubble).toHaveClass('own')
    expect(ownBubble).not.toHaveClass('system')

    const systemText = screen.getByText('Order accepted by the vendor.')
    const systemBubble = systemText.closest('.message')!
    expect(systemBubble).toHaveClass('system')
    expect(systemBubble).not.toHaveClass('own')
  })
})
