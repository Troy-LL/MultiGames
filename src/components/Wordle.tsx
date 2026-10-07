import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  WORDLE_MAX_ATTEMPTS,
  WORDLE_WORD_LENGTH,
} from '../../shared/wordle'
import type {
  WordleBoard,
  WordleMark,
  WordleMode,
  WordleSnapshot,
} from '../../shared/protocol'
import type { ConnectionStatus } from '../lib/usePartyGame'

interface WordleProps {
  game: WordleSnapshot
  selfId: string | null
  status: ConnectionStatus
  onSubmitGuess: (guess: string) => void
  onReset: (mode: WordleMode) => void
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const MARK_RANK: Record<WordleMark, number> = {
  absent: 1,
  present: 2,
  correct: 3,
}

export function Wordle({
  game,
  selfId,
  status,
  onSubmitGuess,
  onReset,
}: WordleProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [prevVersion, setPrevVersion] = useState(game.version)
  if (game.version !== prevVersion) {
    setPrevVersion(game.version)
    setDraft('')
    setError(null)
  }

  const selfBoard = game.boards.find((board) => board.playerId === selfId)
  const canPlay =
    selfBoard !== undefined &&
    !selfBoard.solved &&
    selfBoard.attempts < game.maxAttempts

  const addLetter = useCallback((letter: string) => {
    setError(null)
    setDraft((current) =>
      current.length < WORDLE_WORD_LENGTH
        ? `${current}${letter.toUpperCase()}`
        : current,
    )
  }, [])

  const erase = useCallback(() => {
    setError(null)
    setDraft((current) => current.slice(0, -1))
  }, [])

  const submit = useCallback(() => {
    if (!canPlay) return
    if (draft.length !== WORDLE_WORD_LENGTH) {
      setError('Enter 5 letters.')
      return
    }
    onSubmitGuess(draft)
    setDraft('')
    setError(null)
  }, [canPlay, draft, onSubmitGuess])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        submit()
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        erase()
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault()
        addLetter(event.key)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addLetter, erase, submit])

  const keyboardMarks = useMemo(
    () => getKeyboardMarks(selfBoard),
    [selfBoard],
  )
  const standings = useMemo(() => rankBoards(game.boards), [game.boards])
  const opponentBoards = useMemo(
    () => game.boards.filter((board) => board.playerId !== selfId),
    [game.boards, selfId],
  )
  const displayBoard = selfBoard ?? game.boards[0]

  return (
    <section className="wordle-game" aria-label="Wordle game">
      <WordleControls
        date={game.date}
        dayNumber={game.dayNumber}
        mode={game.mode}
        status={status}
        onReset={onReset}
      />

      <div className="wordle-intro">
        <p>
          {game.mode === 'race'
            ? 'Race for the fewest guesses, then the fastest finish.'
            : 'Team up through chat while every board keeps letters private.'}
        </p>
        <p>Other players see your colors and progress, never your letters.</p>
      </div>

      {game.answer && (
        <p className="wordle-answer" role="status">
          Daily answer: <strong>{game.answer}</strong>
        </p>
      )}

      {error && (
        <p className="wordle-error" role="alert">
          {error}
        </p>
      )}

      <div className="wordle-play-layout">
        <div className="wordle-main-column">
          <div className="wordle-self-stage">
            {displayBoard ? (
              <PlayerWordleBoard
                board={displayBoard}
                draft={displayBoard.playerId === selfId ? draft : ''}
                isSelf={displayBoard.playerId === selfId}
                maxAttempts={game.maxAttempts}
              />
            ) : (
              <div className="loading">Waiting for board…</div>
            )}
          </div>

          <WordleKeyboard
            disabled={!canPlay}
            marks={keyboardMarks}
            onLetter={addLetter}
            onErase={erase}
            onSubmit={submit}
          />
        </div>

        {opponentBoards.length > 0 && (
          <aside
            className="wordle-opponents"
            aria-label={game.mode === 'race' ? 'Opponent boards' : 'Team progress'}
          >
            <h2 className="panel-title">
              {game.mode === 'race' ? 'Opponents' : 'Team progress'}
            </h2>
            <div className="wordle-opponent-list">
              {opponentBoards.map((board) => (
                <OpponentWordleBoard key={board.playerId} board={board} />
              ))}
            </div>
          </aside>
        )}
      </div>

      <section className="wordle-standings" aria-label="Wordle standings">
        <h2 className="panel-title">Standings</h2>
        <ol className="standings-list">
          {standings.map((board) => (
            <li key={board.playerId} className="standing-row">
              <span>{board.name}</span>
              <span>
                {board.solved
                  ? `${board.attempts}/${WORDLE_MAX_ATTEMPTS} · ${formatTime(
                      board.elapsedMs,
                    )}`
                  : `${board.attempts}/${WORDLE_MAX_ATTEMPTS}`}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  )
}

function OpponentWordleBoard({ board }: { board: WordleBoard }) {
  return (
    <article className="wordle-opponent-card">
      <header className="wordle-opponent-header">
        <span className="wordle-opponent-name">{board.name}</span>
        <span className="wordle-card-score">
          {board.solved
            ? `${board.attempts}/${WORDLE_MAX_ATTEMPTS} · ${formatTime(board.elapsedMs)}`
            : `${board.attempts}/${WORDLE_MAX_ATTEMPTS}`}
        </span>
      </header>

      <div
        className="wordle-mini-grid"
        role="grid"
        aria-label={`${board.name}'s masked Wordle progress`}
      >
        {board.rows.map((row, rowIndex) => (
          <div className="wordle-mini-row" role="row" key={rowIndex}>
            {row.map((tile, colIndex) => {
              const classes = [
                'wordle-mini-tile',
                tile.mark ? `wordle-mini-tile-${tile.mark}` : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <span
                  key={`${rowIndex}-${colIndex}`}
                  className={classes}
                  role="gridcell"
                  aria-label={tileLabel(rowIndex, colIndex, null, tile.mark, false)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </article>
  )
}

function WordleControls({
  date,
  dayNumber,
  mode,
  status,
  onReset,
}: {
  date: string
  dayNumber: number
  mode: WordleMode
  status: ConnectionStatus
  onReset: (mode: WordleMode) => void
}) {
  return (
    <div className="wordle-controls">
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

      <div className="wordle-daily">
        Daily #{dayNumber + 1} · {date}
      </div>

      <div className="wordle-mode" role="group" aria-label="Wordle play style">
        {(['race', 'team'] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            className={`btn difficulty-btn ${nextMode === mode ? 'is-active' : ''}`}
            aria-pressed={nextMode === mode}
            // Clicking the active mode used to reset the board (data loss). No-op it.
            onClick={() => nextMode !== mode && onReset(nextMode)}
          >
            {nextMode === 'race' ? 'Race' : 'Team'}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlayerWordleBoard({
  board,
  draft,
  isSelf,
  maxAttempts,
}: {
  board: WordleBoard
  draft: string
  isSelf: boolean
  maxAttempts: number
}) {
  return (
    <article className={`wordle-card ${isSelf ? 'is-self' : ''}`}>
      <header className="wordle-card-header">
        <h2>
          {board.name}
          {isSelf && <span className="player-you"> (you)</span>}
        </h2>
        <span className="wordle-card-score">
          {board.solved
            ? `${board.attempts}/${maxAttempts} · ${formatTime(board.elapsedMs)}`
            : `${board.attempts}/${maxAttempts}`}
        </span>
      </header>

      <div className="wordle-grid" role="grid" aria-label={`${board.name}'s Wordle board`}>
        {board.rows.map((row, rowIndex) => (
          <div className="wordle-row" role="row" key={rowIndex}>
            {row.map((tile, colIndex) => {
              const isDraftRow =
                isSelf && !board.solved && rowIndex === board.attempts
              const draftLetter = isDraftRow ? draft[colIndex] : undefined
              const letter = draftLetter ?? tile.letter
              const mark = tile.mark
              const classes = [
                'wordle-tile',
                mark ? `wordle-tile-${mark}` : '',
                letter && !mark ? 'wordle-tile-filled' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <span
                  key={`${rowIndex}-${colIndex}`}
                  className={classes}
                  role="gridcell"
                  aria-label={tileLabel(rowIndex, colIndex, letter, mark, isSelf)}
                >
                  {letter ?? ''}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </article>
  )
}

function WordleKeyboard({
  disabled,
  marks,
  onLetter,
  onErase,
  onSubmit,
}: {
  disabled: boolean
  marks: Map<string, WordleMark>
  onLetter: (letter: string) => void
  onErase: () => void
  onSubmit: () => void
}) {
  return (
    <div className="wordle-keyboard" aria-label="Wordle keyboard">
      {KEY_ROWS.map((row, rowIndex) => (
        <div className="wordle-key-row" key={row}>
          {rowIndex === 2 && (
            <button
              type="button"
              className="wordle-key wordle-key-wide"
              disabled={disabled}
              onClick={onSubmit}
            >
              Enter
            </button>
          )}
          {[...row].map((letter) => {
            const mark = marks.get(letter)
            return (
              <button
                key={letter}
                type="button"
                className={`wordle-key ${mark ? `wordle-key-${mark}` : ''}`}
                disabled={disabled}
                onClick={() => onLetter(letter)}
              >
                {letter.toUpperCase()}
              </button>
            )
          })}
          {rowIndex === 2 && (
            <button
              type="button"
              className="wordle-key wordle-key-wide"
              disabled={disabled}
              aria-label="Erase"
              onClick={onErase}
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function getKeyboardMarks(board: WordleBoard | undefined): Map<string, WordleMark> {
  const marks = new Map<string, WordleMark>()
  if (!board) return marks

  for (const row of board.rows) {
    for (const tile of row) {
      if (!tile.letter || !tile.mark) continue
      const letter = tile.letter.toLowerCase()
      const current = marks.get(letter)
      if (!current || MARK_RANK[tile.mark] > MARK_RANK[current]) {
        marks.set(letter, tile.mark)
      }
    }
  }

  return marks
}

function rankBoards(boards: WordleBoard[]): WordleBoard[] {
  return [...boards].sort((a, b) => {
    if (a.solved !== b.solved) return a.solved ? -1 : 1
    if (a.solved && b.solved) {
      if (a.attempts !== b.attempts) return a.attempts - b.attempts
      return (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0)
    }
    if (a.attempts !== b.attempts) return b.attempts - a.attempts
    return a.name.localeCompare(b.name)
  })
}

function tileLabel(
  row: number,
  col: number,
  letter: string | null | undefined,
  mark: WordleMark | null,
  isSelf: boolean,
): string {
  const position = `Row ${row + 1}, column ${col + 1}`
  if (!mark) return `${position}, ${letter ?? 'empty'}`
  if (!isSelf) return `${position}, ${mark}, letter hidden`
  return `${position}, ${letter ?? 'empty'}, ${mark}`
}

function formatTime(ms: number | null): string {
  if (ms === null) return '--'
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
