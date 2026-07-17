import { useState } from 'react'

import { MAX_NAME_LENGTH } from '../../shared/protocol'
import { PALETTE, readableText } from '../lib/colors'

interface JoinProps {
  onJoin: (name: string, color: string) => void
}

// Picked once at module load so it stays stable across renders.
const INITIAL_COLOR = PALETTE[Math.floor(Math.random() * PALETTE.length)]

export function Join({ onJoin }: JoinProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(INITIAL_COLOR)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onJoin(trimmed, color)
  }

  return (
    <div className="join-screen">
      <form className="join-card" onSubmit={submit}>
        <h1 className="join-title">Multiplayer Games</h1>
        <p className="join-sub">Pick a name and color to play Sudoku, daily Wordle, or She&apos;s a 2.</p>

        <label className="field-label" htmlFor="name-input">
          Your name
        </label>
        <input
          id="name-input"
          className="text-input"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Ada"
          autoComplete="off"
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />

        <span className="field-label" id="color-label">
          Your color
        </span>
        <div className="color-grid" role="radiogroup" aria-labelledby="color-label">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={`Color ${c}`}
              className={`color-swatch ${c === color ? 'is-active' : ''}`}
              style={{ background: c, color: readableText(c) }}
              onClick={() => setColor(c)}
            >
              {c === color ? '✓' : ''}
            </button>
          ))}
        </div>

        <button type="submit" className="btn btn-primary join-btn" disabled={!name.trim()}>
          Join game
        </button>
      </form>
    </div>
  )
}
