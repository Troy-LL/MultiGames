import type { Player } from '../../shared/protocol'
import { initials, readableText } from '../lib/colors'

interface PlayersProps {
  players: Player[]
  selfId: string | null
}

export function Players({ players, selfId }: PlayersProps) {
  return (
    <section className="players" aria-label="Players online">
      <h2 className="panel-title">
        Players <span className="players-count">{players.length}</span>
      </h2>
      <ul className="players-list">
        {players.map((p) => (
          <li key={p.id} className="player-row">
            <span
              className="player-dot"
              aria-hidden="true"
              style={{ background: p.color, color: readableText(p.color) }}
            >
              {initials(p.name)}
            </span>
            <span className="player-name">
              {p.name}
              {p.id === selfId && <span className="player-you"> (you)</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
