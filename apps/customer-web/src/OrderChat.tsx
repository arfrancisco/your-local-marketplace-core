import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useOrderChat } from './useOrderChat'
import { ApiError } from './api/client'
import type { Message } from './api/types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // mirrors ImageAttachable's server-side limit (ADR 0006)

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const classes = ['message', message.message_type, isOwn ? 'own' : ''].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      {message.body && <p>{message.body}</p>}
      {message.image && <img src={`${API_ORIGIN}${message.image.url}`} alt="" />}
    </div>
  )
}

function firstImageFile(files: FileList | DataTransferItemList | null | undefined): File | null {
  if (!files) return null
  for (let i = 0; i < files.length; i++) {
    const entry = files[i]
    const file = entry instanceof DataTransferItem ? entry.getAsFile() : entry
    if (file && file.type.startsWith('image/')) return file
  }
  return null
}

const MAX_TEXTAREA_HEIGHT = 150

// Shared between customer-web and vendor-web (both are separate Vite apps
// with no shared package yet, so this is intentionally duplicated rather
// than abstracted — see plan notes on ADR 0001). Composer is a single
// auto-growing pill (textarea + attach + send, no separate boxes), Enter to
// send / Shift+Enter for a newline — the familiar modern chat pattern.
// Image attach is drag-and-drop or paste, one image max per message, still
// (ADR 0006's cap is unchanged, only the UX here is).
export function OrderChat({ orderId, currentUserId }: { orderId: number; currentUserId: number }) {
  const { messages, loading, postMessage } = useOrderChat(orderId)
  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!image) { setImagePreviewUrl(null); return }
    const url = URL.createObjectURL(image)
    setImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [body])

  async function send() {
    if (!body.trim() && !image) return
    setError(null)
    setSending(true)
    try {
      await postMessage(body.trim() || null, image)
      setBody('')
      setImage(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send message')
    } finally {
      setSending(false)
    }
  }

  function stageImage(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image must be 5 MB or smaller')
      return
    }
    setError(null)
    setImage(file)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = firstImageFile(e.dataTransfer.files)
    if (file) stageImage(file)
  }

  function onPaste(e: ClipboardEvent) {
    const file = firstImageFile(e.clipboardData.items)
    if (file) stageImage(file)
  }

  if (loading) return <p>Loading chat…</p>

  return (
    <div className="order-chat">
      <div className="message-list">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} isOwn={m.sender_user_id === currentUserId} />
        ))}
      </div>
      <form
        className={`chat-composer${dragOver ? ' drag-over' : ''}`}
        onSubmit={onSubmit}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {imagePreviewUrl && (
          <div className="chat-image-preview">
            <img src={imagePreviewUrl} alt="" />
            <button type="button" onClick={() => setImage(null)} aria-label="Remove image">×</button>
          </div>
        )}
        <div className="chat-input-row">
          <button type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} aria-label="Attach image">
            📎
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder="Message…"
            disabled={sending}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) stageImage(f); e.target.value = '' }}
            hidden
          />
          <button type="submit" className="send-btn" disabled={sending} aria-label="Send">
            ➤
          </button>
        </div>
      </form>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  )
}
