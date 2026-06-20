import { createDeck, shuffleDeck, type CardRank, type PlayingCard } from './cards'
import type { CardsPhase, CardsPlayerScore, CardsSnapshot } from './protocol'

export interface CardsGamePlayer {
  id: string
  name: string
  color: string
}

export interface CardsGameState {
  version: number
  phase: CardsPhase
  describerId: string | null
  describerOrder: string[]
  describerIndex: number
  deck: PlayingCard[]
  current: PlayingCard | null
  collected: Record<string, PlayingCard[]>
  guessedThisRound: string[]
  lastWinnerId: string | null
  finished: boolean
  winnerId: string | null
}

function emptyCollected(playerIds: string[]): Record<string, PlayingCard[]> {
  return Object.fromEntries(playerIds.map((id) => [id, []]))
}

function computeWinner(
  players: CardsGamePlayer[],
  collected: Record<string, PlayingCard[]>,
): string | null {
  const scores = players
    .map((player) => ({
      playerId: player.id,
      count: collected[player.id]?.length ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
  if (scores.length === 0 || scores[0].count === 0) return null
  const top = scores[0].count
  const leaders = scores.filter((score) => score.count === top)
  return leaders.length === 1 ? leaders[0].playerId : null
}

function buildScores(
  players: CardsGamePlayer[],
  collected: Record<string, PlayingCard[]>,
): CardsPlayerScore[] {
  return players
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      color: player.color,
      cards: collected[player.id] ?? [],
    }))
    .sort((a, b) => {
      if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length
      return a.name.localeCompare(b.name)
    })
}

export function createCardsGameState(playerIds: string[] = []): CardsGameState {
  return {
    version: 1,
    phase: 'waiting',
    describerId: null,
    describerOrder: playerIds.slice(),
    describerIndex: 0,
    deck: shuffleDeck(createDeck()),
    current: null,
    collected: emptyCollected(playerIds),
    guessedThisRound: [],
    lastWinnerId: null,
    finished: false,
    winnerId: null,
  }
}

export function syncCardsPlayers(
  state: CardsGameState,
  playerIds: string[],
): CardsGameState {
  const collected = { ...state.collected }
  for (const id of playerIds) {
    if (!collected[id]) collected[id] = []
  }
  for (const id of Object.keys(collected)) {
    if (!playerIds.includes(id)) delete collected[id]
  }
  const describerOrder = state.describerOrder.filter((id) => playerIds.includes(id))
  for (const id of playerIds) {
    if (!describerOrder.includes(id)) describerOrder.push(id)
  }
  let describerIndex = state.describerIndex
  let describerId = state.describerId
  if (describerId && !playerIds.includes(describerId)) {
    describerId = describerOrder[0] ?? null
    describerIndex = 0
  }
  return {
    ...state,
    collected,
    describerOrder,
    describerIndex,
    describerId,
  }
}

export function cardsGameStart(
  state: CardsGameState,
  playerIds: string[],
): CardsGameState | null {
  if (state.phase !== 'waiting' || state.finished || playerIds.length === 0) return null
  return {
    ...state,
    version: state.version + 1,
    describerOrder: playerIds.slice(),
    describerIndex: 0,
    describerId: playerIds[0],
  }
}

export function cardsGameDraw(
  state: CardsGameState,
  actorId: string,
  players: CardsGamePlayer[],
): CardsGameState | null {
  if (state.finished) return null
  if (state.phase !== 'waiting' && state.phase !== 'resolved') return null
  if (actorId !== state.describerId) return null
  if (state.deck.length === 0) {
    return {
      ...state,
      version: state.version + 1,
      finished: true,
      winnerId: computeWinner(players, state.collected),
    }
  }
  return {
    ...state,
    version: state.version + 1,
    current: state.deck[state.deck.length - 1],
    deck: state.deck.slice(0, -1),
    phase: 'describing',
    guessedThisRound: [],
    lastWinnerId: null,
  }
}

export function cardsGameGuess(
  state: CardsGameState,
  actorId: string,
  rank: CardRank,
): CardsGameState | null {
  if (state.phase !== 'describing' || !state.current) return null
  if (actorId === state.describerId) return null
  if (state.guessedThisRound.includes(actorId)) return null

  const guessedThisRound = [...state.guessedThisRound, actorId]
  if (rank !== state.current.rank) {
    return { ...state, guessedThisRound }
  }

  const collected = {
    ...state.collected,
    [actorId]: [...(state.collected[actorId] ?? []), state.current],
  }

  return {
    ...state,
    version: state.version + 1,
    collected,
    guessedThisRound,
    lastWinnerId: actorId,
    phase: 'resolved',
  }
}

export function cardsGameNextRound(
  state: CardsGameState,
  actorId: string,
  players: CardsGamePlayer[],
): CardsGameState | null {
  if (state.phase !== 'resolved') return null
  if (actorId !== state.describerId) return null

  const nextIndex =
    state.describerOrder.length === 0
      ? 0
      : (state.describerIndex + 1) % state.describerOrder.length
  const describerId = state.describerOrder[nextIndex] ?? null
  const finished = state.deck.length === 0

  return {
    ...state,
    version: state.version + 1,
    current: null,
    guessedThisRound: [],
    describerIndex: nextIndex,
    describerId,
    phase: 'waiting',
    finished,
    winnerId: finished ? computeWinner(players, state.collected) : null,
  }
}

export function cardsGameSkip(
  state: CardsGameState,
  actorId: string,
): CardsGameState | null {
  if (state.phase !== 'describing' || !state.current) return null
  if (actorId !== state.describerId) return null

  return {
    ...state,
    version: state.version + 1,
    deck: [state.current, ...state.deck],
    current: null,
    guessedThisRound: [],
    lastWinnerId: null,
    phase: 'resolved',
  }
}

export function cardsGameReset(playerIds: string[]): CardsGameState {
  return createCardsGameState(playerIds)
}

export function cardsGameSnapshot(
  state: CardsGameState,
  players: CardsGamePlayer[],
  options: { showCurrentCard: boolean },
): CardsSnapshot {
  const winnerId =
    state.winnerId ?? (state.finished ? computeWinner(players, state.collected) : null)

  return {
    kind: 'cards',
    version: state.version,
    phase: state.phase,
    describerId: state.describerId,
    cardsRemaining: state.deck.length,
    scores: buildScores(players, state.collected),
    currentCard: options.showCurrentCard ? state.current : null,
    lastWinnerId: state.lastWinnerId,
    finished: state.finished,
    winnerId,
  }
}
