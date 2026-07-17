import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { findConflicts } from '../shared/sudoku'
import type { Difficulty, GameKind, WordleMode } from '../shared/protocol'
import { Board } from './components/Board'
import { Chat } from './components/Chat'
import { Controls } from './components/Controls'
import { Join } from './components/Join'
import { Players } from './components/Players'
import { Wordle } from './components/Wordle'
import { Cards } from './components/Cards'
import { CardsLocalApp } from './components/CardsLocalApp'
import { usePartyGame } from './lib/usePartyGame'

type CardsPlayMode = 'local' | 'online'

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

// Room names live in the URL (?room=), so keep them URL-safe and bounded.
function slugRoom(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return slug || 'lobby'
}

function getCardsPlayMode(): CardsPlayMode | null {
  const params = new URLSearchParams(window.location.search)
  if (params.get('game') === 'cards') {
    return params.get('mode') === 'local' ? 'local' : 'online'
  }
  return null
}

function getInitialGame(): GameKind | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('game') === 'cards' ? 'cards' : null
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile)
  const [selected, setSelected] = useState<number | null>(null)
  const [selectedGame, setSelectedGame] = useState<GameKind | null>(getInitialGame)
  const [cardsPlayMode, setCardsPlayMode] = useState<CardsPlayMode | null>(getCardsPlayMode)
  const [room, setRoom] = useState(getRoom)

  // Switch rooms without a full reload: update the URL and re-subscribe. The
  // socket in usePartyGame re-dials when `room` changes.
  const changeRoom = useCallback((next: string) => {
    const target = slugRoom(next)
    const url = new URL(window.location.href)
    url.searchParams.set('room', target)
    window.history.pushState({}, '', url)
    setRoom(target)
  }, [])

  // Keep room in sync when the user hits back/forward.
  useEffect(() => {
    const onPop = () => setRoom(getRoom())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const {
    configError,
    status,
    stalled,
    reconnect,
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
    startCards,
    drawCard,
    guessCard,
    nextCardsRound,
    skipCardsRound,
    resetCards,
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
      if (gameKind === 'cards') {
        setCardsPlayMode(null)
        return
      }
    },
    [],
  )

  const handleChooseCardsMode = useCallback(
    (mode: CardsPlayMode) => {
      setCardsPlayMode(mode)
      setSelectedGame('cards')
    },
    [],
  )

  const handleBackFromLocalCards = useCallback(() => {
    setSelectedGame(null)
    setCardsPlayMode(null)
  }, [])

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
    document.title = `Multiplayer Games · ${room}`
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

  if (selectedGame === 'cards' && cardsPlayMode === 'local') {
    return <CardsLocalApp onBack={handleBackFromLocalCards} />
  }

  // Misconfigured build (e.g. missing VITE_PARTYKIT_HOST in prod): nothing that
  // needs the server can work, so say so plainly instead of hanging. Local
  // pass-and-play above still works, so this check comes after it.
  if (configError) {
    return <ConfigError message={configError} />
  }

  if (!selectedGame) {
    return (
      <div className="app game-landing-app">
        <header className="app-header">
          <div>
            <h1 className="app-title">Choose your game</h1>
            <p className="app-subtitle">Start with Sudoku, Wordle, or the card game.</p>
          </div>
          <RoomBadge room={room} />
        </header>

        <main className="game-landing" aria-label="Choose a game">
          <GameLanding
            status={status}
            stalled={stalled}
            room={room}
            onChangeRoom={changeRoom}
            onRetry={reconnect}
            onChoose={handleChooseGame}
          />
        </main>
      </div>
    )
  }

  if (selectedGame === 'cards' && cardsPlayMode === null) {
    return (
      <div className="app game-landing-app">
        <header className="app-header">
          <div>
            <h1 className="app-title">She&apos;s a 2</h1>
            <p className="app-subtitle">Play on one device or connect online.</p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSelectedGame(null)
              setCardsPlayMode(null)
            }}
          >
            Back
          </button>
        </header>

        <main className="game-landing" aria-label="Choose how to play">
          <CardsModePicker onChoose={handleChooseCardsMode} />
        </main>
      </div>
    )
  }

  if (!profile) {
    return <Join onJoin={handleJoin} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">Multiplayer Games</h1>
          <p className="app-subtitle">Play Sudoku, daily Wordle, or She&apos;s a 2 together.</p>
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
            ) : game.kind === 'wordle' ? (
              <Wordle
                key={`wordle:${game.version}`}
                game={game}
                selfId={selfId}
                status={status}
                onSubmitGuess={submitWordleGuess}
                onReset={handleWordleReset}
              />
            ) : (
              <Cards
                key={`cards:${game.version}`}
                mode="online"
                game={game}
                selfId={selfId}
                status={status}
                onStart={startCards}
                onDraw={drawCard}
                onGuess={guessCard}
                onNextRound={nextCardsRound}
                onSkip={skipCardsRound}
                onReset={resetCards}
              />
            )
          ) : stalled ? (
            <ConnectionTrouble onRetry={reconnect} />
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
  stalled,
  room,
  onChangeRoom,
  onRetry,
  onChoose,
}: {
  status: string
  stalled: boolean
  room: string
  onChangeRoom: (room: string) => void
  onRetry: () => void
  onChoose: (game: GameKind) => void
}) {
  return (
    <section className="game-landing-card">
      <RoomSwitcher room={room} onChangeRoom={onChangeRoom} />

      <div className="controls-status game-landing-status" aria-live="polite">
        <span className={`dot dot-${status}`} aria-hidden="true" />
        <span className="status-text">
          {status === 'online'
            ? 'Connected'
            : status === 'connecting'
              ? 'Connecting…'
              : 'Offline'}
        </span>
        {stalled && (
          <button type="button" className="btn retry-btn" onClick={onRetry}>
            Retry
          </button>
        )}
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

        <button
          type="button"
          className="game-choice-card cards-choice"
          onClick={() => onChoose('cards')}
        >
          <span className="cards-card-preview" aria-hidden="true">
            <span className="cards-preview-card is-red">2♥</span>
            <span className="cards-preview-card is-black">K♠</span>
            <span className="cards-preview-card is-red">A♦</span>
          </span>
          <span className="game-choice-kicker">Party guess</span>
          <span className="game-choice-title">She&apos;s a 2</span>
          <span className="game-choice-copy">
            Draw a card, describe the rank, and collect cards when you guess right. Pass &amp; play or online.
          </span>
        </button>
      </div>
    </section>
  )
}

function CardsModePicker({ onChoose }: { onChoose: (mode: CardsPlayMode) => void }) {
  return (
    <section className="game-landing-card cards-mode-picker">
      <div className="cards-mode-grid">
        <button
          type="button"
          className="game-choice-card cards-choice cards-mode-local"
          onClick={() => onChoose('local')}
        >
          <span className="cards-card-preview" aria-hidden="true">
            <span className="cards-preview-card is-red">2♥</span>
            <span className="cards-preview-card is-black">K♠</span>
          </span>
          <span className="game-choice-kicker">One device</span>
          <span className="game-choice-title">Pass &amp; play</span>
          <span className="game-choice-copy">
            Add players on this phone and pass it around. No internet or server needed.
          </span>
        </button>

        <button
          type="button"
          className="game-choice-card cards-choice cards-mode-online"
          onClick={() => onChoose('online')}
        >
          <span className="cards-card-preview" aria-hidden="true">
            <span className="cards-preview-card is-red">A♦</span>
            <span className="cards-preview-card is-black">7♣</span>
            <span className="cards-preview-card is-red">Q♥</span>
          </span>
          <span className="game-choice-kicker">Multiplayer</span>
          <span className="game-choice-title">Online room</span>
          <span className="game-choice-copy">
            Everyone on their own phone in the same room via PartyKit.
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
      {(['sudoku', 'wordle', 'cards'] as const).map((game) => (
        <button
          key={game}
          type="button"
          role="tab"
          aria-selected={active === game}
          className={`game-tab ${active === game ? 'is-active' : ''}`}
          onClick={() => onSwitch(game)}
        >
          {game === 'sudoku' ? 'Sudoku' : game === 'wordle' ? 'Wordle' : "She's a 2"}
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
    <div className="numpad-wrap">
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
      {disabled && (
        <p className="numpad-hint" aria-live="polite">
          Tap a cell to enter a number
        </p>
      )}
    </div>
  )
}

function ConnectionTrouble({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="connection-trouble" role="alert">
      <p className="connection-trouble-title">Can’t reach the game server</p>
      <p className="connection-trouble-copy">
        The connection is taking longer than expected. Check your network, then try again.
      </p>
      <button type="button" className="btn btn-primary retry-btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

function RoomSwitcher({
  room,
  onChangeRoom,
}: {
  room: string
  onChangeRoom: (room: string) => void
}) {
  const [name, setName] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) onChangeRoom(name)
  }

  function random() {
    onChangeRoom('room-' + Math.random().toString(36).slice(2, 8))
  }

  return (
    <form className="room-switcher" onSubmit={submit}>
      <label className="room-switcher-label" htmlFor="room-input">
        Room <span className="room-switcher-current">{room}</span>
      </label>
      <div className="room-switcher-controls">
        <input
          id="room-input"
          className="room-input"
          type="text"
          value={name}
          placeholder="Name a room to create or join"
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          Create / Join
        </button>
        <button type="button" className="btn" onClick={random}>
          Random
        </button>
      </div>
      <p className="room-switcher-hint">
        Share the room name (or the invite link) so others land in the same game.
      </p>
    </form>
  )
}

function ConfigError({ message }: { message: string }) {
  return (
    <div className="app">
      <main className="config-error" role="alert">
        <p className="connection-trouble-title">This app isn’t configured</p>
        <p className="connection-trouble-copy">{message}</p>
      </main>
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
