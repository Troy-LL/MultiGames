import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import usePartySocket from 'partysocket/react'

import { resolveHost } from './resolveHost'
import {
  type ChatMessage,
  type CardRank,
  type Difficulty,
  type GameSnapshot,
  type GameKind,
  type Player,
  type ServerMessage,
  type WordleMode,
} from '../../shared/protocol'

const { host: PARTYKIT_HOST, configError } = resolveHost(
  import.meta.env.VITE_PARTYKIT_HOST as string | undefined,
  import.meta.env.PROD,
)

// Fail loudly for whoever deployed this, not just silently in the UI.
if (configError) console.error(`[multigames] ${configError}`)

export type ConnectionStatus = 'connecting' | 'online' | 'offline'

export interface PartyGame {
  /** Non-null when the app is misconfigured (e.g. missing host in prod). */
  configError: string | null
  status: ConnectionStatus
  /** True when we've been unable to load the game for a while (dead host,
   * dropped snapshot, cold server) — the UI shows a Retry affordance. */
  stalled: boolean
  reconnect: () => void
  selfId: string | null
  game: GameSnapshot | null
  players: Player[]
  messages: ChatMessage[]
  /** Cells another player changed recently, for a brief highlight. */
  flashing: ReadonlySet<number>
  setCursor: (index: number | null) => void
  fill: (index: number, value: number) => void
  sendChat: (text: string) => void
  reset: (difficulty: Difficulty) => void
  switchGame: (game: GameKind) => void
  submitWordleGuess: (guess: string) => void
  resetWordle: (mode: WordleMode) => void
  startCards: () => void
  drawCard: () => void
  guessCard: (rank: CardRank) => void
  nextCardsRound: () => void
  skipCardsRound: () => void
  resetCards: () => void
}

const FLASH_MS = 900

export function usePartyGame(
  room: string,
  profile: { name: string; color: string } | null,
): PartyGame {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [stalled, setStalled] = useState(false)
  const [selfId, setSelfId] = useState<string | null>(null)
  const [game, setGame] = useState<GameSnapshot | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [flashing, setFlashing] = useState<Set<number>>(() => new Set())

  // Refs let the (stable) socket handlers and callbacks read the latest values
  // without recreating the socket connection.
  const selfIdRef = useRef<string | null>(null)
  const versionRef = useRef<number>(-1)
  const flashTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  // Briefly mark a cell as "just changed by someone else". Called from the
  // socket message handler (an event handler), so setState here is fine.
  const flashCell = useCallback((index: number) => {
    setFlashing((prev) => new Set(prev).add(index))
    const existing = flashTimers.current.get(index)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      setFlashing((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
      flashTimers.current.delete(index)
    }, FLASH_MS)
    flashTimers.current.set(index, timer)
  }, [])

  const clearFlashes = useCallback(() => {
    for (const timer of flashTimers.current.values()) clearTimeout(timer)
    flashTimers.current.clear()
    setFlashing(new Set())
  }, [])

  // Clean up any pending flash timers on unmount.
  useEffect(() => {
    const map = flashTimers.current
    return () => {
      for (const timer of map.values()) clearTimeout(timer)
      map.clear()
    }
  }, [])

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room,
    onOpen() {
      // Going online triggers the identity-sync effect below, which
      // (re)announces our profile to the room.
      setStatus('online')
    },
    onClose() {
      setStatus('offline')
    },
    onError() {
      setStatus('offline')
    },
    onMessage(event: MessageEvent) {
      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data as string) as ServerMessage
      } catch {
        return
      }
      switch (msg.type) {
        case 'snapshot':
          selfIdRef.current = msg.self
          versionRef.current = msg.game.version
          setSelfId(msg.self)
          setGame(msg.game)
          setPlayers(msg.players)
          setMessages(msg.messages)
          setStalled(false)
          break
        case 'values': {
          versionRef.current = msg.version
          setGame((g) =>
            g && g.kind === 'sudoku' && g.version === msg.version
              ? { ...g, values: msg.values, solved: msg.solved }
              : g,
          )
          // Flash the cell when someone *else* changed it (so a teammate
          // overwriting your tile is visible).
          if (msg.change.by !== selfIdRef.current) {
            flashCell(msg.change.index)
          }
          break
        }
        case 'players':
          setPlayers(msg.players)
          break
        case 'chat':
          setMessages((m) => [...m, msg.message])
          break
        case 'game':
          versionRef.current = msg.game.version
          setGame(msg.game)
          clearFlashes()
          break
        case 'reset':
          versionRef.current = msg.game.version
          setGame(msg.game)
          clearFlashes()
          break
      }
    },
  })

  const send = useCallback(
    (data: unknown) => socket.send(JSON.stringify(data)),
    [socket],
  )

  // Connection watchdog: if we can't get to a loaded game within a few seconds
  // (dead host, dropped snapshot, cold server), surface a Retry instead of an
  // indefinite silent "Loading game…" / "Connecting…".
  // Arm a timer while we're not yet at a loaded game; the timer (not the
  // effect body) flips `stalled`. `stalled` is cleared in the snapshot/game
  // handlers below and in reconnect, so recovery needs no set-state-in-effect.
  const ready = status === 'online' && game !== null
  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setStalled(true), 8000)
    return () => clearTimeout(timer)
  }, [ready])

  const reconnect = useCallback(() => {
    setStalled(false)
    setStatus('connecting')
    socket.reconnect()
  }, [socket])

  // Push identity whenever the profile changes after the socket is open.
  useEffect(() => {
    if (profile && status === 'online') {
      send({ type: 'join', name: profile.name, color: profile.color })
    }
  }, [profile, status, send])

  const setCursor = useCallback(
    (index: number | null) => send({ type: 'cursor', index }),
    [send],
  )

  const fill = useCallback(
    (index: number, value: number) => {
      // Optimistically apply our own edit for instant feedback; the server
      // echo (authoritative) will reconcile, including last-write-wins when
      // two players edit the same tile.
      setGame((g) => {
        if (
          !g ||
          g.kind !== 'sudoku' ||
          g.given[index] ||
          g.values[index] === value
        ) {
          return g
        }
        const values = g.values.slice()
        values[index] = value
        return { ...g, values }
      })
      send({ type: 'fill', index, value, version: versionRef.current })
    },
    [send],
  )

  const sendChat = useCallback((text: string) => send({ type: 'chat', text }), [send])
  const reset = useCallback(
    (difficulty: Difficulty) => send({ type: 'reset', difficulty }),
    [send],
  )
  const switchGame = useCallback(
    (game: GameKind) => send({ type: 'switchGame', game }),
    [send],
  )
  const submitWordleGuess = useCallback(
    (guess: string) =>
      send({ type: 'wordleGuess', guess, version: versionRef.current }),
    [send],
  )
  const resetWordle = useCallback(
    (mode: WordleMode) => send({ type: 'wordleReset', mode }),
    [send],
  )
  const startCards = useCallback(() => send({ type: 'cardsStart' }), [send])
  const drawCard = useCallback(
    () => send({ type: 'cardsDraw', version: versionRef.current }),
    [send],
  )
  const guessCard = useCallback(
    (rank: CardRank) =>
      send({ type: 'cardsGuess', rank, version: versionRef.current }),
    [send],
  )
  const nextCardsRound = useCallback(
    () => send({ type: 'cardsNextRound', version: versionRef.current }),
    [send],
  )
  const skipCardsRound = useCallback(
    () => send({ type: 'cardsSkip', version: versionRef.current }),
    [send],
  )
  const resetCards = useCallback(() => send({ type: 'cardsReset' }), [send])

  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  )
}
