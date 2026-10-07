import { useState } from 'react'

import { initials, PALETTE } from '../lib/colors'
import { defaultLocalPlayerColor, type LocalCardsPlayer } from '../lib/useLocalCardsGame'

interface CardsSetupProps {
  players: LocalCardsPlayer[]
  onAdd: (name: string, color: string) => void
  onRemove: (playerId: string) => void
  onStart: () => void
}

export function CardsSetup({ players, onAdd, onRemove, onStart }: CardsSetupProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(() => defaultLocalPlayerColor(players.length))

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, color)
    setName('')
    setColor(defaultLocalPlayerColor(players.length + 1))
  }

  return (
    <div className="cards-setup">
      <header className="cards-setup-header">
        <h2>Pass &amp; play setup</h2>
        <p>Add everyone playing on this device. Pass the phone when it&apos;s your turn.</p>
      </header>

      <form className="cards-setup-form" onSubmit={handleAdd}>
        <label className="field-label" htmlFor="cards-player-name">
          Player name
        </label>
        <input
          id="cards-player-name"
          className="text-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Alex"
          maxLength={24}
        />

        <span className="field-label">Color</span>
        <div className="color-grid cards-setup-colors">
          {PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`color-swatch ${color === swatch ? 'is-active' : ''}`}
              style={{ background: swatch, color: swatch === '#eab308' ? '#1a1a1a' : '#fff' }}
              aria-label={`Color ${swatch}`}
              aria-pressed={color === swatch}
              onClick={() => setColor(swatch)}
            >
              {/* Preview your initials only on the chosen swatch — repeating them
                  on every color read as broken ("?" ×8 before a name is typed). */}
              {color === swatch && name ? initials(name) : ''}
            </button>
          ))}
        </div>

        <button type="submit" className="btn btn-primary cards-setup-add">
          Add player
        </button>
      </form>

      {players.length > 0 ? (
        <ul className="cards-setup-list" aria-label="Players">
          {players.map((player) => (
            <li key={player.id} className="cards-setup-player">
              <span
                className="player-dot"
                style={{ background: player.color, color: '#fff' }}
                aria-hidden="true"
              >
                {initials(player.name)}
              </span>
              <span className="cards-setup-player-name">{player.name}</span>
              <button
                type="button"
                className="btn cards-setup-remove"
                onClick={() => onRemove(player.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cards-setup-empty">Add at least two players to start.</p>
      )}

      <button
        type="button"
        className="btn btn-primary cards-setup-start"
        disabled={players.length < 2}
        onClick={onStart}
      >
        Start game
      </button>
    </div>
  )
}
