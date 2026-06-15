import { useCallback, useEffect, useMemo, useState } from 'react'

import { findConflicts } from '../shared/sudoku'
import type { Difficulty, GameKind, WordleMode } from '../shared/protocol'
import { Board } from './components/Board'
import { Chat } from './components/Chat'
import { Controls } from './components/Controls'
import { Join } from './components/Join'
import { Players } from './components/Players'
import { Wordle } from './components/Wordle'
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
  const [selectedGame, setSelectedGame] = useState<GameKind | null>(null)
  const [room] = useState(getRoom)

  const {
    status,
    selfId,
    game,
    players,
    messages,
    flashing,
    setCursor,
    fill,
    sendChat,
    reset,
    switchGame,
    submitWordleGuess,
    resetWordle,
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

  const handleSwitchGame = useCallback(
    (gameKind: GameKind) => {
      setSelectedGame(gameKind)
      setSelected(null)
      switchGame(gameKind)
    },
    [switchGame],
  )

  const handleChooseGame = useCallback(
    (gameKind: GameKind) => {
      setSelectedGame(gameKind)
      setSelected(null)
      if (status === 'online') switchGame(gameKind)
    },
    [status, switchGame],
  )

  const handleWordleReset = useCallback(
    (mode: WordleMode) => resetWordle(mode),
    [resetWordle],
  )

  const conflicts = useMemo(
    () =>
      game && game.kind === 'sudoku'
        ? findConflicts(game.values)
        : new Set<number>(),
    [game],
  )

  // When a new board starts (e.g. someone hit "New game"), drop the stale
  // local selection so we don't keep highlighting a cell on the old puzzle.
  // This is the "adjust state while rendering" pattern (no effect needed).
  const gameKey = game ? `${game.kind}:${game.version}` : null
  const [prevGameKey, setPrevGameKey] = useState<string | null>(null)
  if (gameKey !== prevGameKey) {
    setPrevGameKey(gameKey)
    setSelected(null)
  }

  // Keep the document title fresh with the room name.
  useEffect(() => {
    document.title = `Sudoku + Wordle · ${room}`
  }, [room])

  useEffect(() => {
    if (
      profile &&
      selectedGame &&
      status === 'online' &&
      game?.kind !== selectedGame
    ) {
      switchGame(selectedGame)
    }
  }, [game?.kind, profile, selectedGame, status, switchGame])

  if (!profile) {
    return <Join onJoin={handleJoin} />
  }

  if (!selectedGame) {
    return (
      <div className="app game-landing-app">
        <header className="app-header">
          <div>
            <h1 className="app-title">Choose your game</h1>
            <p className="app-subtitle">Start with Sudoku or race today&apos;s Wordle.</p>
          </div>
          <RoomBadge room={room} />
        </header>

        <main className="game-landing" aria-label="Choose a game">
          <GameLanding status={status} onChoose={handleChooseGame} />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">Multiplayer Games</h1>
          <p className="app-subtitle">Play Sudoku or daily Wordle together.</p>
        </div>
        <RoomBadge room={room} />
      </header>

      <main className="layout">
        <div className="play-area">
          <GameTabs active={game?.kind ?? 'sudoku'} onSwitch={handleSwitchGame} />
          {game ? (
            game.kind === 'sudoku' ? (
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
                  flashing={flashing}
                  onSelect={handleSelect}
                  onFill={handleFill}
                />
                <NumberPad
                  disabled={
                    selected === null ||
                    (selected !== null && game.given[selected])
                  }
                  onInput={(n) => selected !== null && handleFill(selected, n)}
                />
              </>
            ) : (
              <Wordle
                key={`wordle:${game.version}`}
                game={game}
                selfId={selfId}
                status={status}
                onSubmitGuess={submitWordleGuess}
                onReset={handleWordleReset}
              />
            )
          ) : (
            <div className="loading">Loading game…</div>
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

function GameLanding({
  status,
  onChoose,
}: {
  status: string
  onChoose: (game: GameKind) => void
}) {
  return (
    <section className="game-landing-card">
      <div className="controls-status game-landing-status" aria-live="polite">
        <span className={`dot dot-${status}`} aria-hidden="true" />
        <span className="status-text">
          {status === 'online'
            ? 'Connected'
            : status === 'connecting'
              ? 'Connecting…'
              : 'Offline'}
        </span>
      </div>

      <div className="game-choice-grid">
        <button
          type="button"
          className="game-choice-card sudoku-choice"
          onClick={() => onChoose('sudoku')}
        >
          <span className="game-choice-kicker">Classic co-op</span>
          <span className="game-choice-title">Sudoku</span>
          <span className="game-choice-copy">
            Share one puzzle, fill cells together, and spot conflicts live.
          </span>
        </button>

        <button
          type="button"
          className="game-choice-card wordle-choice"
          onClick={() => onChoose('wordle')}
        >
          <span className="wordle-card-preview" aria-hidden="true">
            <span className="wordle-preview-row">
              <span className="wordle-preview-tile is-correct">W</span>
              <span className="wordle-preview-tile is-present">O</span>
              <span className="wordle-preview-tile is-absent">R</span>
              <span className="wordle-preview-tile is-correct">D</span>
              <span className="wordle-preview-tile is-absent">S</span>
            </span>
            <span className="wordle-preview-row">
              <span className="wordle-preview-tile is-absent">R</span>
              <span className="wordle-preview-tile is-correct">A</span>
              <span className="wordle-preview-tile is-present">C</span>
              <span className="wordle-preview-tile is-absent">E</span>
              <span className="wordle-preview-tile is-correct">S</span>
            </span>
          </span>
          <span className="game-choice-kicker">Daily race</span>
          <span className="game-choice-title">Wordle</span>
          <span className="game-choice-copy">
            Solve today&apos;s word fastest, or team up with hidden letters.
          </span>
        </button>
      </div>
    </section>
  )
}

function GameTabs({
  active,
  onSwitch,
}: {
  active: GameKind
  onSwitch: (game: GameKind) => void
}) {
  return (
    <div className="game-tabs" role="tablist" aria-label="Game">
      {(['sudoku', 'wordle'] as const).map((game) => (
        <button
          key={game}
          type="button"
          role="tab"
          aria-selected={active === game}
          className={`game-tab ${active === game ? 'is-active' : ''}`}
          onClick={() => onSwitch(game)}
        >
          {game === 'sudoku' ? 'Sudoku' : 'Wordle'}
        </button>
      ))}
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
