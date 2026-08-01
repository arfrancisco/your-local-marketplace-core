import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderChat } from './OrderChat'
import { useOrderChat } from './useOrderChat'
import type { Message } from './api/types'

vi.mock('./useOrderChat', () => ({
  useOrderChat: vi.fn(),
}))

const systemMessage: Message = {
  id: 1,
  conversation_id: 1,
  sender_user_id: null,
  message_type: 'system',
  body: 'Order accepted by the vendor.',
  image: null,
  created_at: '2026-01-01T00:00:00Z',
  edited_at: null,
}

const ownMessage: Message = {
  id: 2,
  conversation_id: 1,
  sender_user_id: 99,
  message_type: 'text',
  body: 'Sounds good, thanks!',
  image: null,
  created_at: '2026-01-01T00:01:00Z',
  edited_at: null,
}

describe('OrderChat message rendering', () => {
  it('renders a system message as a plain centered line — no bubble, no own/other styling', () => {
    vi.mocked(useOrderChat).mockReturnValue({
      messages: [systemMessage, ownMessage],
      loading: false,
      postMessage: vi.fn(),
    })

    render(<OrderChat orderId={1} currentUserId={99} />)

    const systemLine = screen.getByText('Order accepted by the vendor.')
    expect(systemLine.closest('.message')).toHaveClass('system')
    expect(systemLine.closest('.message')).not.toHaveClass('own')

    const ownLine = screen.getByText('Sounds good, thanks!')
    expect(ownLine.closest('.message')).toHaveClass('own')
    expect(ownLine.closest('.message')).not.toHaveClass('system')
  })

  it('shows a loading state before messages arrive', () => {
    vi.mocked(useOrderChat).mockReturnValue({
      messages: [],
      loading: true,
      postMessage: vi.fn(),
    })

    render(<OrderChat orderId={1} currentUserId={99} />)

    expect(screen.getByText('Loading chat…')).toBeInTheDocument()
  })
})
