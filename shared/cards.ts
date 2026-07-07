// Standard 52-card deck helpers for the "She's a 2" guessing game.

export const CARD_RANKS = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
] as const

export type CardRank = (typeof CARD_RANKS)[number]

export const CARD_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const
export type CardSuit = (typeof CARD_SUITS)[number]

export interface PlayingCard {
  rank: CardRank
  suit: CardSuit
}

/** Catchphrase-style hints for each rank (suit does not matter). */
export const RANK_HINTS: Record<CardRank, string> = {
  '2': "She's pretty but she's obsessive — oh yeah, she's a 2.",
  '3': "She's sweet but she's always the third wheel — she's a 3.",
  '4': "She's fine but she fakes every accent — she's a 4.",
  '5': "She's a smoke show but she's five minutes late to everything — she's a 5.",
  '6': "She's stunning but she's still hung up on her ex from six years ago — she's a 6.",
  '7': "She's gorgeous but she's seven drinks deep before appetizers — she's a 7.",
  '8': "She's a ten but she ate your fries and lied about it — she's an 8.",
  '9': "She's perfect but she screenshots your texts to the group chat — she's a 9.",
  '10': "She's a literal ten — no buts, no notes.",
  J: "She's charming but she jacks your aux cord every time — jack.",
  Q: "She's regal but she queues drama like it's a sport — queen.",
  K: "He's king energy but he still lives with three roommates — king.",
  A: "She's an ace but she'll ace your heart and ghost you — ace.",
}

export function createDeck(): PlayingCard[] {
  const deck: PlayingCard[] = []
  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

export function shuffleDeck(deck: PlayingCard[]): PlayingCard[] {
  const next = deck.slice()
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function normalizeRankGuess(raw: string): CardRank | null {
  const guess = raw.trim().toUpperCase()
  if (guess === 'ACE') return 'A'
  if (guess === 'JACK') return 'J'
  if (guess === 'QUEEN') return 'Q'
  if (guess === 'KING') return 'K'
  if (CARD_RANKS.includes(guess as CardRank)) return guess as CardRank
  return null
}

export function formatCard(card: PlayingCard): string {
  const suitSymbol =
    card.suit === 'hearts'
      ? '♥'
      : card.suit === 'diamonds'
        ? '♦'
        : card.suit === 'clubs'
          ? '♣'
          : '♠'
  return `${card.rank}${suitSymbol}`
}

export function isRedSuit(suit: CardSuit): boolean {
  return suit === 'hearts' || suit === 'diamonds'
}
