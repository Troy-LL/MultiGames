import { Server, routePartykitRequest, type Connection } from 'partyserver'

import {
  createDeck,
  shuffleDeck,
  type CardRank,
  type PlayingCard,
} from '../shared/cards'
import {
  generatePuzzle,
  isSolved,
  type Difficulty,
  type Grid,
} from '../shared/sudoku'
import {
  WORDLE_MAX_ATTEMPTS,
  WORDLE_WORD_LENGTH,
  evaluateWordleGuess,
  getDailyWordle,
  isPotentialWordleGuess,
  normalizeWordleGuess,
} from '../shared/wordle'
import {
  MAX_CHAT_HISTORY,
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  type ChatMessage,
  type ClientMessage,
  type CardsPlayerScore,
  type CardsPhase,
  type CardsSnapshot,
  type GameKind,
  type GameSnapshot,
  type Player,
  type ServerMessage,
  type WordleBoard,
  type WordleMode,
  type WordleSnapshot,
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
const SUDOKU_CELLS = 81
const WORDLE_CELLS = WORDLE_MAX_ATTEMPTS * WORDLE_WORD_LENGTH

interface WordleGuess {
  word: string
  marks: ReturnType<typeof evaluateWordleGuess>
}

interface WordlePlayerState {
  guesses: WordleGuess[]
  startedAt: number
  solvedAt: number | null
}

function sanitizeColor(color: unknown, fallback: string): string {
  return typeof color === 'string' && HEX_COLOR.test(color) ? color : fallback
}

export class MultiplayerGameServer extends Server<Env> {
  private activeGame: GameKind = 'sudoku'

  private sudokuVersion = 0
  private sudokuPuzzle: Grid = []
  private sudokuGiven: boolean[] = []
  private sudokuValues: Grid = []
  private sudokuDifficulty: Difficulty = 'easy'
  private sudokuSolved = false

  private wordleVersion = 0
  private wordleDate = ''
  private wordleDayNumber = 0
  private wordleAnswer = ''
  private wordleMode: WordleMode = 'race'
  private wordleBoards = new Map<string, WordlePlayerState>()

  private cardsVersion = 0
  private cardsPhase: CardsPhase = 'waiting'
  private cardsDeck: PlayingCard[] = []
  private cardsCurrent: PlayingCard | null = null
  private cardsDescriberId: string | null = null
  private cardsDescriberOrder: string[] = []
  private cardsDescriberIndex = 0
  private cardsCollected = new Map<string, PlayingCard[]>()
  private cardsGuessedThisRound = new Set<string>()
  private cardsLastWinnerId: string | null = null
  private cardsFinished = false
  private cardsWinnerId: string | null = null

  private players = new Map<string, Player>()
  private messages: ChatMessage[] = []

  // Room host = first connection to join. When lobbyClosed is true, only the
  // host may switch the active game (prevents accidental switches mid-game).
  private hostId: string | null = null
  private lobbyClosed = false

  onStart() {
    this.newSudokuGame('easy')
    this.resetWordle('race')
    this.resetCards()
  }

  private newSudokuGame(difficulty: Difficulty) {
    const { puzzle } = generatePuzzle(difficulty)
    this.sudokuVersion++
    this.sudokuPuzzle = puzzle
    this.sudokuGiven = puzzle.map((v) => v !== 0)
    this.sudokuValues = puzzle.slice()
    this.sudokuDifficulty = difficulty
    this.sudokuSolved = false
    // Clear every player's cursor so stale selections don't linger.
    for (const player of this.players.values()) player.cursor = null
  }

  private sudokuSnapshot(): GameSnapshot {
    return {
      kind: 'sudoku',
      version: this.sudokuVersion,
      puzzle: this.sudokuPuzzle,
      given: this.sudokuGiven,
      values: this.sudokuValues,
      solved: this.sudokuSolved,
      difficulty: this.sudokuDifficulty,
    }
  }

  private resetWordle(mode: WordleMode = this.wordleMode) {
    const daily = getDailyWordle()
    this.wordleVersion++
    this.wordleDate = daily.dateKey
    this.wordleDayNumber = daily.dayNumber
    this.wordleAnswer = daily.answer
    this.wordleMode = mode
    this.wordleBoards.clear()
    for (const player of this.players.values()) player.cursor = null
  }

  private ensureWordleIsCurrent() {
    const daily = getDailyWordle()
    if (daily.dateKey !== this.wordleDate || daily.answer !== this.wordleAnswer) {
      this.resetWordle(this.wordleMode)
    }
  }

  private wordleStateFor(playerId: string): WordlePlayerState {
    const existing = this.wordleBoards.get(playerId)
    if (existing) return existing

    const state: WordlePlayerState = {
      guesses: [],
      startedAt: Date.now(),
      solvedAt: null,
    }
    this.wordleBoards.set(playerId, state)
    return state
  }

  private wordleBoardFor(player: Player, viewerId: string): WordleBoard {
    const state = this.wordleStateFor(player.id)
    const rows = Array.from({ length: WORDLE_MAX_ATTEMPTS }, (_, row) => {
      const guess = state.guesses[row]
      return Array.from({ length: WORDLE_WORD_LENGTH }, (_, col) => ({
        letter:
          guess && player.id === viewerId ? guess.word[col].toUpperCase() : null,
        mark: guess?.marks[col] ?? null,
      }))
    })

    return {
      playerId: player.id,
      name: player.name,
      color: player.color,
      rows,
      attempts: state.guesses.length,
      solved: state.solvedAt !== null,
      elapsedMs: state.solvedAt === null ? null : state.solvedAt - state.startedAt,
    }
  }

  private wordleSnapshot(viewerId: string): WordleSnapshot {
    this.ensureWordleIsCurrent()
    const boards = [...this.players.values()]
      .map((player) => this.wordleBoardFor(player, viewerId))
      .sort((a, b) => {
        if (a.playerId === viewerId) return -1
        if (b.playerId === viewerId) return 1
        return a.name.localeCompare(b.name)
      })
    const selfState = this.wordleBoards.get(viewerId)
    const done =
      selfState !== undefined &&
      (selfState.solvedAt !== null ||
        selfState.guesses.length >= WORDLE_MAX_ATTEMPTS)

    return {
      kind: 'wordle',
      version: this.wordleVersion,
      date: this.wordleDate,
      dayNumber: this.wordleDayNumber,
      mode: this.wordleMode,
      maxAttempts: WORDLE_MAX_ATTEMPTS,
      boards,
      answer: done ? this.wordleAnswer.toUpperCase() : null,
    }
  }

  private resetCards() {
    this.cardsVersion++
    this.cardsPhase = 'waiting'
    this.cardsDeck = shuffleDeck(createDeck())
    this.cardsCurrent = null
    this.cardsDescriberId = null
    this.cardsDescriberOrder = [...this.players.keys()]
    this.cardsDescriberIndex = 0
    this.cardsCollected.clear()
    for (const player of this.players.values()) {
      this.cardsCollected.set(player.id, [])
    }
    this.cardsGuessedThisRound.clear()
    this.cardsLastWinnerId = null
    this.cardsFinished = false
    this.cardsWinnerId = null
    for (const player of this.players.values()) player.cursor = null
  }

  private ensureCardsPlayer(playerId: string) {
    if (!this.cardsCollected.has(playerId)) {
      this.cardsCollected.set(playerId, [])
    }
  }

  private cardsScores(): CardsPlayerScore[] {
    return [...this.players.values()]
      .map((player) => ({
        playerId: player.id,
        name: player.name,
        color: player.color,
        cards: this.cardsCollected.get(player.id) ?? [],
      }))
      .sort((a, b) => {
        if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length
        return a.name.localeCompare(b.name)
      })
  }

  private cardsWinner(): string | null {
    const scores = this.cardsScores()
    if (scores.length === 0 || scores[0].cards.length === 0) return null
    const top = scores[0].cards.length
    const leaders = scores.filter((score) => score.cards.length === top)
    return leaders.length === 1 ? leaders[0].playerId : null
  }

  private advanceCardsDescriber() {
    if (this.cardsDescriberOrder.length === 0) {
      this.cardsDescriberId = null
      return
    }
    this.cardsDescriberIndex =
      (this.cardsDescriberIndex + 1) % this.cardsDescriberOrder.length
    this.cardsDescriberId = this.cardsDescriberOrder[this.cardsDescriberIndex]
  }

  private setCardsDescriber(playerId: string) {
    this.cardsDescriberId = playerId
    const index = this.cardsDescriberOrder.indexOf(playerId)
    if (index >= 0) this.cardsDescriberIndex = index
  }

  private cardsSnapshot(viewerId: string): CardsSnapshot {
    const showCard =
      this.cardsCurrent !== null &&
      (this.cardsPhase === 'resolved' ||
        (this.cardsPhase === 'describing' && viewerId === this.cardsDescriberId))

    return {
      kind: 'cards',
      version: this.cardsVersion,
      phase: this.cardsPhase,
      describerId: this.cardsDescriberId,
      cardsRemaining: this.cardsDeck.length,
      scores: this.cardsScores(),
      currentCard: showCard ? this.cardsCurrent : null,
      guessedThisRound: [...this.cardsGuessedThisRound],
      lastWinnerId: this.cardsLastWinnerId,
      finished: this.cardsFinished,
      winnerId: this.cardsWinnerId,
    }
  }

  private allCardsGuessersHaveGuessed(): boolean {
    const guessers = [...this.players.keys()].filter(
      (id) => id !== this.cardsDescriberId,
    )
    return (
      guessers.length > 0 &&
      guessers.every((id) => this.cardsGuessedThisRound.has(id))
    )
  }

  private snapshotFor(viewerId: string): GameSnapshot {
    if (this.activeGame === 'wordle') return this.wordleSnapshot(viewerId)
    if (this.activeGame === 'cards') return this.cardsSnapshot(viewerId)
    return this.sudokuSnapshot()
  }

  private sendAll(message: ServerMessage, exclude?: string[]) {
    super.broadcast(JSON.stringify(message), exclude)
  }

  private send(conn: Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message))
  }

  private broadcastActiveGame() {
    for (const conn of this.getConnections()) {
      this.send(conn, { type: 'game', game: this.snapshotFor(conn.id) })
    }
  }

  onConnect(conn: Connection) {
    const player: Player = {
      id: conn.id,
      name: 'Guest',
      color: PALETTE[this.players.size % PALETTE.length],
      cursor: null,
    }
    this.players.set(conn.id, player)
    this.ensureCardsPlayer(conn.id)
    if (
      this.activeGame === 'cards' &&
      !this.cardsFinished &&
      !this.cardsDescriberOrder.includes(conn.id)
    ) {
      this.cardsDescriberOrder.push(conn.id)
    }

    // First player in an empty room becomes the host.
    const hostChanged = this.hostId === null
    if (hostChanged) this.hostId = conn.id

    this.send(conn, {
      type: 'snapshot',
      self: conn.id,
      game: this.snapshotFor(conn.id),
      players: [...this.players.values()],
      messages: this.messages,
      hostId: this.hostId,
      lobbyClosed: this.lobbyClosed,
    })
    this.broadcastPlayers()
    if (hostChanged) this.broadcastRoom()
  }

  private broadcastRoom() {
    this.sendAll({ type: 'room', hostId: this.hostId, lobbyClosed: this.lobbyClosed })
  }

  onClose(conn: Connection) {
    this.players.delete(conn.id)
    this.wordleBoards.delete(conn.id)
    // Host left: hand off to the next remaining player (or null if empty).
    let hostChanged = false
    if (this.hostId === conn.id) {
      this.hostId = this.players.keys().next().value ?? null
      hostChanged = true
    }
    this.cardsCollected.delete(conn.id)
    this.cardsDescriberOrder = this.cardsDescriberOrder.filter((id) => id !== conn.id)
    if (this.cardsDescriberId === conn.id) {
      if (this.cardsDescriberOrder.length > 0) {
        this.cardsDescriberIndex %= this.cardsDescriberOrder.length
        this.cardsDescriberId = this.cardsDescriberOrder[this.cardsDescriberIndex]
      } else {
        this.cardsDescriberId = null
      }
    }
    this.broadcastPlayers()
    if (hostChanged) this.broadcastRoom()
    if (this.activeGame === 'wordle' || this.activeGame === 'cards') {
      this.broadcastActiveGame()
    }
  }

  private broadcastPlayers() {
    this.sendAll({ type: 'players', players: [...this.players.values()] })
  }

  onMessage(sender: Connection, raw: string | ArrayBuffer) {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
    let msg: ClientMessage
    try {
      msg = JSON.parse(text) as ClientMessage
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
        this.ensureCardsPlayer(player.id)
        this.broadcastPlayers()
        if (this.activeGame === 'wordle' || this.activeGame === 'cards') {
          this.broadcastActiveGame()
        }
        break
      }
      case 'cursor': {
        const index = msg.index
        const max = this.activeGame === 'wordle' ? WORDLE_CELLS : SUDOKU_CELLS
        const valid =
          index === null ||
          (Number.isInteger(index) && index >= 0 && index < max)
        player.cursor = valid ? index : null
        this.broadcastPlayers()
        break
      }
      case 'fill': {
        if (this.activeGame !== 'sudoku') break
        const { index, value, version } = msg
        // Reject actions aimed at a previous board (e.g. a fill that was in
        // flight when someone started a new game).
        if (version !== this.sudokuVersion) break
        if (!Number.isInteger(index) || index < 0 || index >= SUDOKU_CELLS) break
        if (this.sudokuGiven[index]) break
        if (!Number.isInteger(value) || value < 0 || value > 9) break
        if (this.sudokuValues[index] === value) break
        this.sudokuValues[index] = value
        this.sudokuSolved = isSolved(this.sudokuValues)
        this.sendAll({
          type: 'values',
          version: this.sudokuVersion,
          values: this.sudokuValues,
          solved: this.sudokuSolved,
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
        this.sendAll({ type: 'chat', message })
        break
      }
      case 'reset': {
        if (this.activeGame !== 'sudoku') break
        const difficulty: Difficulty =
          msg.difficulty === 'medium' || msg.difficulty === 'hard'
            ? msg.difficulty
            : 'easy'
        this.newSudokuGame(difficulty)
        this.sendAll({ type: 'reset', game: this.sudokuSnapshot() })
        this.broadcastPlayers()
        break
      }
      case 'switchGame': {
        // When the lobby is closed, only the host may change the game.
        if (this.lobbyClosed && sender.id !== this.hostId) break
        if (msg.game !== 'sudoku' && msg.game !== 'wordle' && msg.game !== 'cards') break
        this.activeGame = msg.game
        if (this.activeGame === 'wordle') this.ensureWordleIsCurrent()
        if (this.activeGame === 'cards' && this.cardsPhase === 'waiting' && this.cardsDeck.length === 0) {
          this.resetCards()
        }
        for (const activePlayer of this.players.values()) activePlayer.cursor = null
        this.broadcastActiveGame()
        this.broadcastPlayers()
        break
      }
      case 'setLobbyClosed': {
        // Only the host may open/close the lobby.
        if (sender.id !== this.hostId) break
        this.lobbyClosed = Boolean(msg.closed)
        this.broadcastRoom()
        break
      }
      case 'wordleGuess': {
        if (this.activeGame !== 'wordle') break
        this.ensureWordleIsCurrent()
        if (msg.version !== this.wordleVersion) break
        if (!isPotentialWordleGuess(msg.guess)) break

        const state = this.wordleStateFor(sender.id)
        if (
          state.solvedAt !== null ||
          state.guesses.length >= WORDLE_MAX_ATTEMPTS
        ) {
          break
        }

        const word = normalizeWordleGuess(msg.guess)
        const marks = evaluateWordleGuess(this.wordleAnswer, word)
        state.guesses.push({ word, marks })
        if (word === this.wordleAnswer) state.solvedAt = Date.now()
        this.broadcastActiveGame()
        break
      }
      case 'wordleReset': {
        if (this.activeGame !== 'wordle') break
        const mode: WordleMode = msg.mode === 'team' ? 'team' : 'race'
        this.resetWordle(mode)
        this.broadcastActiveGame()
        this.broadcastPlayers()
        break
      }
      case 'cardsStart': {
        if (this.activeGame !== 'cards') break
        if (this.cardsPhase !== 'waiting' || this.cardsFinished) break
        this.cardsDescriberOrder = [...this.players.keys()]
        if (this.cardsDescriberOrder.length === 0) break
        this.cardsDescriberIndex = 0
        this.cardsDescriberId = this.cardsDescriberOrder[0]
        this.cardsVersion++
        this.broadcastActiveGame()
        break
      }
      case 'cardsDraw': {
        if (this.activeGame !== 'cards') break
        if (msg.version !== this.cardsVersion) break
        if (this.cardsFinished) break
        if (this.cardsPhase !== 'waiting' && this.cardsPhase !== 'resolved') break
        if (sender.id !== this.cardsDescriberId) break
        if (this.cardsDeck.length === 0) {
          this.cardsFinished = true
          this.cardsWinnerId = this.cardsWinner()
          this.cardsVersion++
          this.broadcastActiveGame()
          break
        }
        this.cardsCurrent = this.cardsDeck.pop() ?? null
        this.cardsPhase = 'describing'
        this.cardsGuessedThisRound.clear()
        this.cardsLastWinnerId = null
        this.cardsVersion++
        this.broadcastActiveGame()
        break
      }
      case 'cardsGuess': {
        if (this.activeGame !== 'cards') break
        if (msg.version !== this.cardsVersion) break
        if (this.cardsPhase !== 'describing' || !this.cardsCurrent) break
        if (sender.id === this.cardsDescriberId) break
        if (this.cardsGuessedThisRound.has(sender.id)) break
        const rank = msg.rank as CardRank
        if (!rank) break
        this.cardsGuessedThisRound.add(sender.id)
        if (rank !== this.cardsCurrent.rank) {
          if (this.allCardsGuessersHaveGuessed()) {
            this.cardsDeck.unshift(this.cardsCurrent)
            this.cardsLastWinnerId = null
            this.cardsPhase = 'resolved'
          }
          this.cardsVersion++
          this.broadcastActiveGame()
          break
        }

        this.ensureCardsPlayer(sender.id)
        this.cardsCollected.get(sender.id)?.push(this.cardsCurrent)
        this.cardsLastWinnerId = sender.id
        this.cardsPhase = 'resolved'
        this.cardsVersion++
        this.broadcastActiveGame()
        break
      }
      case 'cardsNextRound': {
        if (this.activeGame !== 'cards') break
        if (msg.version !== this.cardsVersion) break
        if (this.cardsPhase !== 'resolved') break
        if (sender.id !== this.cardsDescriberId) break
        this.cardsCurrent = null
        this.cardsGuessedThisRound.clear()
        this.advanceCardsDescriber()
        if (this.cardsDeck.length === 0) {
          this.cardsPhase = 'waiting'
          this.cardsFinished = true
          this.cardsWinnerId = this.cardsWinner()
        } else {
          this.cardsPhase = 'waiting'
        }
        this.cardsVersion++
        this.broadcastActiveGame()
        break
      }
      case 'cardsSkip': {
        if (this.activeGame !== 'cards') break
        if (msg.version !== this.cardsVersion) break
        if (this.cardsPhase !== 'describing' || !this.cardsCurrent) break
        if (sender.id !== this.cardsDescriberId) break
        this.cardsDeck.unshift(this.cardsCurrent)
        this.cardsGuessedThisRound.clear()
        this.cardsPhase = 'resolved'
        this.cardsLastWinnerId = null
        this.cardsVersion++
        this.broadcastActiveGame()
        break
      }
      case 'cardsReset': {
        if (this.activeGame !== 'cards') break
        this.resetCards()
        this.broadcastActiveGame()
        this.broadcastPlayers()
        break
      }
    }
  }
}

interface Env {
  // Durable Object binding. Named MAIN so partysocket's default party ("main")
  // routes here via routePartykitRequest (it matches the URL party segment to a
  // binding name case-insensitively).
  MAIN: DurableObjectNamespace<MultiplayerGameServer>
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env as never)) ||
      new Response('Not found', { status: 404 })
    )
  },
} satisfies ExportedHandler<Env>
