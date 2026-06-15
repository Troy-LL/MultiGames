import type * as Party from 'partykit/server'

import {
  generatePuzzle,
  isSolved,
  type Difficulty,
  type Grid,
} from '../shared/sudoku'
import {
  MAX_CHAT_HISTORY,
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  type ChatMessage,
  type ClientMessage,
  type GameSnapshot,
  type Player,
  type ServerMessage,
} from '../shared/protocol'

const PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function sanitizeColor(color: unknown, fallback: string): string {
  return typeof color === 'string' && HEX_COLOR.test(color) ? color : fallback
}

export default class SudokuServer implements Party.Server {
  private version = 0
  private puzzle: Grid = []
  private solution: Grid = []
  private given: boolean[] = []
  private values: Grid = []
  private difficulty: Difficulty = 'easy'
  private solved = false

  private players = new Map<string, Player>()
  private messages: ChatMessage[] = []

  constructor(readonly room: Party.Room) {}

  onStart() {
    this.newGame('easy')
  }

  private newGame(difficulty: Difficulty) {
    const { puzzle, solution } = generatePuzzle(difficulty)
    this.version++
    this.puzzle = puzzle
    this.solution = solution
    this.given = puzzle.map((v) => v !== 0)
    this.values = puzzle.slice()
    this.difficulty = difficulty
    this.solved = false
    // Clear every player's cursor so stale selections don't linger.
    for (const player of this.players.values()) player.cursor = null
  }

  private snapshot(): GameSnapshot {
    return {
      version: this.version,
      puzzle: this.puzzle,
      given: this.given,
      values: this.values,
      solved: this.solved,
      difficulty: this.difficulty,
    }
  }

  private broadcast(message: ServerMessage, exclude?: string[]) {
    this.room.broadcast(JSON.stringify(message), exclude)
  }

  private send(conn: Party.Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message))
  }

  onConnect(conn: Party.Connection) {
    const player: Player = {
      id: conn.id,
      name: 'Guest',
      color: PALETTE[this.players.size % PALETTE.length],
      cursor: null,
    }
    this.players.set(conn.id, player)

    this.send(conn, {
      type: 'snapshot',
      self: conn.id,
      game: this.snapshot(),
      players: [...this.players.values()],
      messages: this.messages,
    })
    this.broadcastPlayers()
  }

  onClose(conn: Party.Connection) {
    this.players.delete(conn.id)
    this.broadcastPlayers()
  }

  private broadcastPlayers() {
    this.broadcast({ type: 'players', players: [...this.players.values()] })
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw) as ClientMessage
    } catch {
      return
    }
    const player = this.players.get(sender.id)
    if (!player) return

    switch (msg.type) {
      case 'join': {
        const name =
          typeof msg.name === 'string'
            ? msg.name.trim().slice(0, MAX_NAME_LENGTH)
            : ''
        player.name = name || 'Guest'
        player.color = sanitizeColor(msg.color, player.color)
        this.broadcastPlayers()
        break
      }
      case 'cursor': {
        const index = msg.index
        const valid =
          index === null ||
          (Number.isInteger(index) && index >= 0 && index < 81)
        player.cursor = valid ? index : null
        this.broadcastPlayers()
        break
      }
      case 'fill': {
        const { index, value, version } = msg
        // Reject actions aimed at a previous board (e.g. a fill that was in
        // flight when someone started a new game).
        if (version !== this.version) break
        if (!Number.isInteger(index) || index < 0 || index >= 81) break
        if (this.given[index]) break
        if (!Number.isInteger(value) || value < 0 || value > 9) break
        if (this.values[index] === value) break
        this.values[index] = value
        this.solved = isSolved(this.values)
        this.broadcast({
          type: 'values',
          version: this.version,
          values: this.values,
          solved: this.solved,
          change: { index, by: sender.id },
        })
        break
      }
      case 'chat': {
        const text = msg.text.trim().slice(0, MAX_CHAT_LENGTH)
        if (!text) break
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          playerId: player.id,
          name: player.name,
          color: player.color,
          text,
          ts: Date.now(),
        }
        this.messages.push(message)
        if (this.messages.length > MAX_CHAT_HISTORY) {
          this.messages = this.messages.slice(-MAX_CHAT_HISTORY)
        }
        this.broadcast({ type: 'chat', message })
        break
      }
      case 'reset': {
        const difficulty: Difficulty =
          msg.difficulty === 'medium' || msg.difficulty === 'hard'
            ? msg.difficulty
            : 'easy'
        this.newGame(difficulty)
        this.broadcast({ type: 'reset', game: this.snapshot() })
        this.broadcastPlayers()
        break
      }
    }
  }
}

SudokuServer satisfies Party.Worker
