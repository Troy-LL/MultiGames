import type { Difficulty } from '../../shared/protocol'
import type { ConnectionStatus } from '../lib/usePartyGame'

interface ControlsProps {
  difficulty: Difficulty
  status: ConnectionStatus
  solved: boolean
  onReset: (difficulty: Difficulty) => void
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

export function Controls({ difficulty, status, solved, onReset }: ControlsProps) {
  return (
    <div className="controls">
      <div className="controls-status" aria-live="polite">
        <span className={`dot dot-${status}`} aria-hidden="true" />
        <span className="status-text">
          {status === 'online'
            ? 'Connected'
            : status === 'connecting'
              ? 'Connecting…'
              : 'Offline'}
        </span>
      </div>

      <div
        className="difficulty"
        role="group"
        aria-label="Start a new game at difficulty"
      >
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={`btn difficulty-btn ${d === difficulty ? 'is-active' : ''}`}
            aria-pressed={d === difficulty}
            onClick={() => onReset(d)}
          >
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {solved && (
        <p className="solved-banner" role="status">
          🎉 Solved! Nice teamwork.
        </p>
      )}
    </div>
  )
}
