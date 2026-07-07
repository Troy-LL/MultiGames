import { Cards } from './Cards'
import { CardsSetup } from './CardsSetup'
import { useLocalCardsGame } from '../lib/useLocalCardsGame'

interface CardsLocalAppProps {
  onBack: () => void
}

export function CardsLocalApp({ onBack }: CardsLocalAppProps) {
  const local = useLocalCardsGame()

  return (
    <div className="app cards-local-app">
      <header className="app-header">
        <div>
          <h1 className="app-title">She&apos;s a 2</h1>
          <p className="app-subtitle">Pass &amp; play on one device — no server required.</p>
        </div>
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
      </header>

      <main className="cards-local-main">
        {!local.started ? (
          <CardsSetup
            players={local.players}
            onAdd={local.addPlayer}
            onRemove={local.removePlayer}
            onStart={local.start}
          />
        ) : (
          <Cards
            mode="local"
            game={local.game}
            selfId={local.holderId}
            status="local"
            roster={local.players}
            holderId={local.holderId}
            guessedThisRound={local.guessedThisRound}
            onClaimDevice={local.claimDevice}
            onReleaseDevice={local.releaseDevice}
            onStart={local.start}
            onDraw={local.draw}
            onGuess={local.guess}
            onNextRound={local.nextRound}
            onSkip={local.skip}
            onReset={local.reset}
          />
        )}
      </main>
    </div>
  )
}
