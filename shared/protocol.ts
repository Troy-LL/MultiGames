// Wire protocol shared between the PartyKit server and the React client.
import type { Difficulty } from './sudoku'

export type { Difficulty }

export interface Player {
  id: string
  name: string
  color: string
  /** Index (0-80) of the cell the player currently has selected, or null. */
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

export interface GameSnapshot {
  /** Original clues; 0 = empty. Used to know which cells are locked. */
  puzzle: number[]
  /** True where the cell is a fixed clue and cannot be edited. */
  given: boolean[]
  /** Current values for every cell (includes the givens). */
  values: number[]
  solved: boolean
  difficulty: Difficulty
}

// Client -> Server
export type ClientMessage =
  | { type: 'join'; name: string; color: string }
  | { type: 'cursor'; index: number | null }
  | { type: 'fill'; index: number; value: number }
  | { type: 'chat'; text: string }
  | { type: 'reset'; difficulty: Difficulty }

// Server -> Client
export type ServerMessage =
  | {
      type: 'snapshot'
      self: string
      game: GameSnapshot
      players: Player[]
      messages: ChatMessage[]
    }
  | { type: 'values'; values: number[]; solved: boolean }
  | { type: 'players'; players: Player[] }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'reset'; game: GameSnapshot }

export const MAX_CHAT_HISTORY = 100
export const MAX_CHAT_LENGTH = 300
export const MAX_NAME_LENGTH = 24
