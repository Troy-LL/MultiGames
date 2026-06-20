import { useCallback, useMemo, useState } from 'react'

import {
  CARD_RANKS,
  RANK_HINTS,
  formatCard,
  isRedSuit,
  type CardRank,
} from '../../shared/cards'
import type { CardsSnapshot } from '../../shared/protocol'
import type { ConnectionStatus } from '../lib/usePartyGame'

interface CardsProps {
  game: CardsSnapshot
  selfId: string | null
  status: ConnectionStatus
  onStart: () => void
  onDraw: () => void
  onGuess: (rank: CardRank) => void
  onNextRound: () => void
  onSkip: () => void
  onReset: () => void
}

export function Cards({
  game,
  selfId,
  status,
  onStart,
  onDraw,
  onGuess,
  onNextRound,
  onSkip,
  onReset,
}: CardsProps) {
  const [showHints, setShowHints] = useState(false)
  const [guessedVersion, setGuessedVersion] = useState<number | null>(null)
  const [prevVersion, setPrevVersion] = useState(game.version)
  if (game.version !== prevVersion) {
    setPrevVersion(game.version)
    setGuessedVersion(null)
  }

  const isDescriber = selfId !== null && selfId === game.describerId
  const describer = game.scores.find((score) => score.playerId === game.describerId)
  const selfScore = game.scores.find((score) => score.playerId === selfId)
  const winner = game.scores.find((score) => score.playerId === game.winnerId)
  const lastWinner = game.scores.find((score) => score.playerId === game.lastWinnerId)
  const alreadyGuessed =
    selfId !== null &&
    game.phase === 'describing' &&
    guessedVersion === game.version

  const canGuess =
    !isDescriber &&
    game.phase === 'describing' &&
    !alreadyGuessed &&
    status === 'online'

  const handleGuess = useCallback(
    (rank: CardRank) => {
      setGuessedVersion(game.version)
      onGuess(rank)
    },
    [game.version, onGuess],
  )

  const phaseLabel = useMemo(() => {
    if (game.finished) return 'Game over'
    if (game.phase === 'waiting' && !game.describerId) return 'Waiting to start'
    if (game.phase === 'waiting') return 'Ready for next card'
    if (game.phase === 'describing') return 'Describe the card'
    return 'Round resolved'
  }, [game.describerId, game.finished, game.phase])

  return (
    <div className="cards-game">
      <div className="cards-controls">
        <div className="cards-status">
          <span className="cards-phase">{phaseLabel}</span>
          <span className="cards-deck-count">{game.cardsRemaining} cards left</span>
        </div>
        <div className="cards-actions">
          {!game.describerId && !game.finished ? (
            <button type="button" className="btn btn-primary" onClick={onStart}>
              Start game
            </button>
          ) : null}
          {isDescriber && game.phase === 'waiting' && !game.finished ? (
            <button type="button" className="btn btn-primary" onClick={onDraw}>
              Draw card
            </button>
          ) : null}
          {isDescriber && game.phase === 'describing' ? (
            <button type="button" className="btn" onClick={onSkip}>
              Nobody got it
            </button>
          ) : null}
          {isDescriber && game.phase === 'resolved' && !game.finished ? (
            <button type="button" className="btn btn-primary" onClick={onNextRound}>
              Next round
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onReset}>
            New deck
          </button>
          <button
            type="button"
            className="btn"
            aria-expanded={showHints}
            onClick={() => setShowHints((open) => !open)}
          >
            {showHints ? 'Hide hints' : 'Rank hints'}
          </button>
        </div>
      </div>

      {showHints ? (
        <section className="cards-hints" aria-label="Rank hints">
          <p className="cards-hints-intro">
            Describe the card by rank only — suit does not matter. Example for a 2:
          </p>
          <ul className="cards-hints-list">
            {CARD_RANKS.map((rank) => (
              <li key={rank}>
                <span className="cards-hint-rank">{rank}</span>
                <span>{RANK_HINTS[rank]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="cards-play-layout">
        <section className="cards-stage" aria-label="Current round">
          {game.finished ? (
            <div className="cards-finished">
              <h2>Deck finished</h2>
              {winner ? (
                <p>
                  <span className="cards-winner-name" style={{ color: winner.color }}>
                    {winner.name}
                  </span>{' '}
                  wins with {winner.cards.length} cards!
                </p>
              ) : (
                <p>It&apos;s a tie — play again to break it.</p>
              )}
            </div>
          ) : game.phase === 'waiting' ? (
            <div className="cards-waiting">
              {describer ? (
                <p>
                  <span className="cards-describer-name" style={{ color: describer.color }}>
                    {describer.name}
                  </span>{' '}
                  {isDescriber ? '— draw a card and describe it out loud.' : 'is describing next.'}
                </p>
              ) : (
                <p>Hit start when everyone has joined.</p>
              )}
            </div>
          ) : game.currentCard ? (
            <div className="cards-current">
              <div
                className={`cards-playing-card ${isRedSuit(game.currentCard.suit) ? 'is-red' : 'is-black'}`}
                aria-label={`${game.currentCard.rank} of ${game.currentCard.suit}`}
              >
                <span className="cards-playing-rank">{game.currentCard.rank}</span>
                <span className="cards-playing-suit" aria-hidden="true">
                  {game.currentCard.suit === 'hearts'
                    ? '♥'
                    : game.currentCard.suit === 'diamonds'
                      ? '♦'
                      : game.currentCard.suit === 'clubs'
                        ? '♣'
                        : '♠'}
                </span>
              </div>
              {isDescriber && game.phase === 'describing' ? (
                <p className="cards-describer-copy">
                  Describe this card without saying the rank. Hint:{' '}
                  <em>{RANK_HINTS[game.currentCard.rank]}</em>
                </p>
              ) : null}
              {game.phase === 'resolved' ? (
                <p className="cards-reveal-copy">
                  It was {formatCard(game.currentCard)}.
                  {lastWinner ? (
                    <>
                      {' '}
                      <span style={{ color: lastWinner.color }}>{lastWinner.name}</span> got it!
                    </>
                  ) : (
                    ' Nobody guessed it.'
                  )}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="cards-waiting">
              <p>Waiting for the next card…</p>
            </div>
          )}

          {canGuess ? (
            <div className="cards-guess-pad" role="group" aria-label="Guess the rank">
              <p className="cards-guess-label">What rank is it?</p>
              <div className="cards-guess-grid">
                {CARD_RANKS.map((rank) => (
                  <button
                    key={rank}
                    type="button"
                    className="btn cards-guess-btn"
                    onClick={() => handleGuess(rank)}
                  >
                    {rank}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {alreadyGuessed ? (
            <p className="cards-guess-sent" aria-live="polite">
              Guess sent. Waiting for others…
            </p>
          ) : null}
        </section>

        <section className="cards-standings" aria-label="Scores">
          <h2>Cards collected</h2>
          <ol className="cards-score-list">
            {game.scores.map((score, index) => (
              <li
                key={score.playerId}
                className={`cards-score-row ${score.playerId === selfId ? 'is-self' : ''}`}
              >
                <div className="cards-score-header">
                  <span className="cards-score-rank">#{index + 1}</span>
                  <span className="cards-score-name" style={{ color: score.color }}>
                    {score.name}
                    {score.playerId === game.describerId ? ' · describing' : ''}
                  </span>
                  <span className="cards-score-count">{score.cards.length}</span>
                </div>
                {score.cards.length > 0 ? (
                  <div className="cards-collected">
                    {score.cards.map((card, cardIndex) => (
                      <span
                        key={`${card.rank}-${card.suit}-${cardIndex}`}
                        className={`cards-mini ${isRedSuit(card.suit) ? 'is-red' : 'is-black'}`}
                        title={formatCard(card)}
                      >
                        {formatCard(card)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          {selfScore ? (
            <p className="cards-self-total">You have {selfScore.cards.length} cards.</p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
