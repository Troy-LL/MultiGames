import { useEffect, useRef, useState } from 'react'

import { MAX_CHAT_LENGTH, type ChatMessage } from '../../shared/protocol'
import { initials, readableText } from '../lib/colors'

interface ChatProps {
  messages: ChatMessage[]
  selfId: string | null
  onSend: (text: string) => void
}

export function Chat({ messages, selfId, onSend }: ChatProps) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  return (
    <section className="chat" aria-label="Chat">
      <h2 className="panel-title">Chat</h2>
      <ul className="chat-list" ref={listRef} aria-live="polite">
        {messages.length === 0 && (
          <li className="chat-empty">No messages yet. Say hi! 👋</li>
        )}
        {messages.map((m) => (
          <li
            key={m.id}
            className={`chat-msg ${m.playerId === selfId ? 'chat-mine' : ''}`}
          >
            <span
              className="chat-avatar"
              aria-hidden="true"
              style={{ background: m.color, color: readableText(m.color) }}
            >
              {initials(m.name)}
            </span>
            <div className="chat-bubble">
              <span className="chat-name">{m.name}</span>
              <span className="chat-text">{m.text}</span>
            </div>
          </li>
        ))}
      </ul>
      <form className="chat-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-input">
          Message
        </label>
        <input
          id="chat-input"
          className="chat-input"
          value={text}
          maxLength={MAX_CHAT_LENGTH}
          placeholder="Message…"
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}
