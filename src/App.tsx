import { useCallback, useEffect, useMemo, useState } from 'react'

import { findConflicts } from '../shared/sudoku'
import type { Difficulty } from '../shared/protocol'
import { Board } from './components/Board'
import { Chat } from './components/Chat'
import { Controls } from './components/Controls'
import { Join } from './components/Join'
import { Players } from './components/Players'
import { usePartyGame } from './lib/usePartyGame'

interface Profile {
  name: string
  color: string
}

const PROFILE_KEY = 'sudoku.profile'

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

function getRoom(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('room')?.trim() || 'lobby'
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile)
  const [selected, setSelected] = useState<number | null>(null)
  const [room] = useState(getRoom)

  const {
    status,
    selfId,
    game,
    players,
    messages,
    setCursor,
    fill,
    sendChat,
    reset,
  } = usePartyGame(room, profile)

  const handleJoin = useCallback((name: string, color: string) => {
    const next = { name, color }
    setProfile(next)
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage errors (e.g. private mode).
    }
  }, [])

  const handleSelect = useCallback(
    (index: number) => {
      setSelected(index)
      setCursor(index)
    },
    [setCursor],
  )

  const handleFill = useCallback(
    (index: number, value: number) => fill(index, value),
    [fill],
  )

  const handleReset = useCallback(
    (difficulty: Difficulty) => reset(difficulty),
    [reset],
  )

  const conflicts = useMemo(
    () => (game ? findConflicts(game.values) : new Set<number>()),
    [game],
  )

  // Keep the document title fresh with the player count.
  useEffect(() => {
    document.title = `Sudoku · ${room}`
  }, [room])

  if (!profile) {
    return <Join onJoin={handleJoin} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Multiplayer Sudoku</h1>
        <RoomBadge room={room} />
      </header>

      <main className="layout">
        <div className="play-area">
          {game ? (
            <>
              <Controls
                difficulty={game.difficulty}
                status={status}
                solved={game.solved}
                onReset={handleReset}
              />
              <Board
                values={game.values}
                given={game.given}
                conflicts={conflicts}
                selected={selected}
                players={players}
                selfId={selfId}
                onSelect={handleSelect}
                onFill={handleFill}
              />
              <NumberPad
                disabled={selected === null || (selected !== null && game.given[selected])}
                onInput={(n) => selected !== null && handleFill(selected, n)}
              />
            </>
          ) : (
            <div className="loading">Loading puzzle…</div>
          )}
        </div>

        <aside className="sidebar">
          <Players players={players} selfId={selfId} />
          <Chat messages={messages} selfId={selfId} onSend={sendChat} />
        </aside>
      </main>
    </div>
  )
}

function NumberPad({
  disabled,
  onInput,
}: {
  disabled: boolean
  onInput: (n: number) => void
}) {
  return (
    <div className="numpad" role="group" aria-label="Number input">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button
          key={n}
          type="button"
          className="btn numpad-btn"
          disabled={disabled}
          onClick={() => onInput(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className="btn numpad-btn numpad-erase"
        disabled={disabled}
        onClick={() => onInput(0)}
        aria-label="Erase"
      >
        ⌫
      </button>
    </div>
  )
}

function RoomBadge({ room }: { room: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    const url = new URL(window.location.href)
    url.searchParams.set('room', room)
    navigator.clipboard?.writeText(url.toString()).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => undefined,
    )
  }

  return (
    <button type="button" className="room-badge" onClick={copy} title="Copy invite link">
      <span className="room-label">room</span>
      <span className="room-name">{room}</span>
      <span className="room-copy">{copied ? 'copied!' : 'invite'}</span>
    </button>
  )
}
