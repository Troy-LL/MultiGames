// Wire protocol shared between the PartyKit server and the React client.
import type { CardRank, PlayingCard } from './cards'
import type { Difficulty } from './sudoku'
import type { WordleMark } from './wordle'

export type { CardRank, Difficulty, PlayingCard, WordleMark }

export type GameKind = 'sudoku' | 'wordle' | 'cards'
export type WordleMode = 'race' | 'team'

export interface Player {
  id: string
  name: string
  color: string
  /** Index of the selected cell in the active game, or null. */
  cursor: number | null
}

export interface ChatMessage {
  id: string
  playerId: string
  name: string
  color: string
  text: string
  ts: number
}

export interface SudokuSnapshot {
  kind: 'sudoku'
  /**
   * Monotonic id for the current board. Bumped on every new game so the
   * server can reject actions that were sent for a previous board (e.g. a
   * `fill` that was in flight when another player started a new game).
   */
  version: number
  /** Original clues; 0 = empty. Used to know which cells are locked. */
  puzzle: number[]
  /** True where the cell is a fixed clue and cannot be edited. */
  given: boolean[]
  /** Current values for every cell (includes the givens). */
  values: number[]
  solved: boolean
  difficulty: Difficulty
}

export interface WordleTile {
  /** Present only for your own board; other players' letters are masked. */
  letter: string | null
  mark: WordleMark | null
}

export interface WordleBoard {
  playerId: string
  name: string
  color: string
  rows: WordleTile[][]
  attempts: number
  solved: boolean
  elapsedMs: number | null
}

export interface WordleSnapshot {
  kind: 'wordle'
  version: number
  date: string
  dayNumber: number
  mode: WordleMode
  maxAttempts: number
  boards: WordleBoard[]
  answer: string | null
}

export type CardsPhase = 'waiting' | 'describing' | 'resolved'

export interface CardsPlayerScore {
  playerId: string
  name: string
  color: string
  cards: PlayingCard[]
}

export interface CardsSnapshot {
  kind: 'cards'
  version: number
  phase: CardsPhase
  describerId: string | null
  cardsRemaining: number
  scores: CardsPlayerScore[]
  /** Hidden from guessers during the describing phase. */
  currentCard: PlayingCard | null
  /** Player ids who already guessed this round (wrong or right). */
  guessedThisRound: string[]
  lastWinnerId: string | null
  finished: boolean
  winnerId: string | null
}

export type GameSnapshot = SudokuSnapshot | WordleSnapshot | CardsSnapshot

/** Identifies who made the most recent cell change, for UI feedback. */
export interface CellChange {
  index: number
  by: string
}

// Client -> Server
export type ClientMessage =
  | { type: 'join'; name: string; color: string }
  | { type: 'cursor'; index: number | null }
  | { type: 'fill'; index: number; value: number; version: number }
  | { type: 'chat'; text: string }
  | { type: 'reset'; difficulty: Difficulty }
  | { type: 'switchGame'; game: GameKind }
  | { type: 'setLobbyClosed'; closed: boolean }
  | { type: 'wordleGuess'; guess: string; version: number }
  | { type: 'wordleReset'; mode: WordleMode }
  | { type: 'cardsStart' }
  | { type: 'cardsDraw'; version: number }
  | { type: 'cardsGuess'; rank: CardRank; version: number }
  | { type: 'cardsNextRound'; version: number }
  | { type: 'cardsSkip'; version: number }
  | { type: 'cardsReset' }

// Server -> Client
export type ServerMessage =
  | {
      type: 'snapshot'
      self: string
      game: GameSnapshot
      players: Player[]
      messages: ChatMessage[]
      /** Connection id of the room host (first to join), or null if empty. */
      hostId: string | null
      /** When true, only the host may switch the active game. */
      lobbyClosed: boolean
    }
  | {
      type: 'values'
      version: number
      values: number[]
      solved: boolean
      change: CellChange
    }
  | { type: 'game'; game: GameSnapshot }
  | { type: 'players'; players: Player[] }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'reset'; game: GameSnapshot }
  | { type: 'room'; hostId: string | null; lobbyClosed: boolean }

export const MAX_CHAT_HISTORY = 100
export const MAX_CHAT_LENGTH = 300
export const MAX_NAME_LENGTH = 24
