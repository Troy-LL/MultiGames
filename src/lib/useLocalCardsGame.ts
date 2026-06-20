import { useCallback, useMemo, useState } from 'react'

import type { CardRank } from '../../shared/cards'
import {
  cardsGameDraw,
  cardsGameGuess,
  cardsGameNextRound,
  cardsGameReset,
  cardsGameSkip,
  cardsGameStart,
  cardsGameSnapshot,
  createCardsGameState,
  syncCardsPlayers,
  type CardsGamePlayer,
} from '../../shared/cardsGame'
import type { CardsSnapshot } from '../../shared/protocol'
import { PALETTE } from './colors'

export type LocalCardsPlayer = CardsGamePlayer

export interface LocalCardsGame {
  players: LocalCardsPlayer[]
  game: CardsSnapshot
  started: boolean
  holderId: string | null
  cardVisible: boolean
  guessedThisRound: string[]
  addPlayer: (name: string, color: string) => void
  removePlayer: (playerId: string) => void
  claimDevice: (playerId: string) => void
  releaseDevice: () => void
  showCard: () => void
  start: () => void
  draw: () => void
  guess: (rank: CardRank) => void
  nextRound: () => void
  skip: () => void
  reset: () => void
}

function nextPlayerId(): string {
  return `local-${crypto.randomUUID()}`
}

export function useLocalCardsGame(): LocalCardsGame {
  const [players, setPlayers] = useState<LocalCardsPlayer[]>([])
  const [state, setState] = useState(() => createCardsGameState())
  const [started, setStarted] = useState(false)
  const [holderId, setHolderId] = useState<string | null>(null)
  const [cardVisible, setCardVisible] = useState(false)

  const syncPlayers = useCallback((nextPlayers: LocalCardsPlayer[]) => {
    setState((current) =>
      syncCardsPlayers(current, nextPlayers.map((player) => player.id)),
    )
  }, [])

  const addPlayer = useCallback(
    (name: string, color: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const player: LocalCardsPlayer = {
        id: nextPlayerId(),
        name: trimmed.slice(0, 24),
        color,
      }
      setPlayers((current) => {
        const next = [...current, player]
        syncPlayers(next)
        return next
      })
    },
    [syncPlayers],
  )

  const removePlayer = useCallback(
    (playerId: string) => {
      setPlayers((current) => {
        const next = current.filter((player) => player.id !== playerId)
        syncPlayers(next)
        return next
      })
      setHolderId((current) => (current === playerId ? null : current))
      setStarted(false)
      setCardVisible(false)
    },
    [syncPlayers],
  )

  const claimDevice = useCallback((playerId: string) => {
    setHolderId(playerId)
    setCardVisible(false)
  }, [])

  const releaseDevice = useCallback(() => {
    setHolderId(null)
    setCardVisible(false)
  }, [])

  const showCard = useCallback(() => setCardVisible(true), [])

  const game = useMemo(() => {
    const showCurrentCard =
      state.current !== null &&
      (state.phase === 'resolved' ||
        (state.phase === 'describing' &&
          holderId === state.describerId &&
          cardVisible))
    return cardsGameSnapshot(state, players, { showCurrentCard })
  }, [cardVisible, holderId, players, state])

  const start = useCallback(() => {
    const next = cardsGameStart(
      state,
      players.map((player) => player.id),
    )
    if (!next) return
    setState(next)
    setStarted(true)
    setHolderId(null)
    setCardVisible(false)
  }, [players, state])

  const draw = useCallback(() => {
    if (!holderId) return
    const next = cardsGameDraw(state, holderId, players)
    if (!next) return
    setState(next)
    setCardVisible(true)
  }, [holderId, players, state])

  const guess = useCallback(
    (rank: CardRank) => {
      if (!holderId) return
      const next = cardsGameGuess(state, holderId, rank)
      if (!next) return
      setState(next)
      if (next.phase === 'resolved') setCardVisible(true)
    },
    [holderId, state],
  )

  const nextRound = useCallback(() => {
    if (!holderId) return
    const next = cardsGameNextRound(state, holderId, players)
    if (!next) return
    setState(next)
    setHolderId(null)
    setCardVisible(false)
  }, [holderId, players, state])

  const skip = useCallback(() => {
    if (!holderId) return
    const next = cardsGameSkip(state, holderId)
    if (!next) return
    setState(next)
    setCardVisible(true)
  }, [holderId, state])

  const reset = useCallback(() => {
    setState(cardsGameReset(players.map((player) => player.id)))
    setHolderId(null)
    setCardVisible(false)
  }, [players])

  return {
    players,
    game,
    started,
    holderId,
    cardVisible,
    guessedThisRound: state.guessedThisRound,
    addPlayer,
    removePlayer,
    claimDevice,
    releaseDevice,
    showCard,
    start,
    draw,
    guess,
    nextRound,
    skip,
    reset,
  }
}

export function defaultLocalPlayerColor(index: number): string {
  return PALETTE[index % PALETTE.length]
}
