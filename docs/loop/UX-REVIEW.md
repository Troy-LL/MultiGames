# UX review — MultiGames (frontend-design lens)

Reviewed against captured screenshots (desktop + mobile 390px): landing, join, sudoku board, wordle, cards mode picker, cards local setup, connection-trouble, 2-session multiplayer. Ranked by severity. Fixed items applied this session are marked.

## Fixed this session
1. **Cards color swatches showed "?" ×8** (`CardsSetup.tsx:57`) — `initials(name || '?')` rendered on every swatch, so before a name is typed all 8 read as broken, and the same initial repeated 8× encoded nothing. **Fix**: preview initials only on the *selected* swatch, empty otherwise; added `aria-pressed`. (skill: "nothing quietly does double duty"; structure must encode something true.)
2. **Silent connection hang → recovery UX** (see TICK-3) — replaced indefinite "Loading game…"/"Connecting…" with a `role="alert"` "Can't reach the game server" + **Retry**. Copy follows the skill's failure-state guidance: explains what's wrong + how to fix, interface voice, not apologetic.

## High / medium — recommended (not yet applied)
3. **No in-product lobby creation** (med, ties to the user's report). Rooms come *only* from the `?room=` URL param; the sole affordance is RoomBadge "invite" (copies current URL). There is no "New room" / name-a-room control, so a user who wants to "create a lobby" can't — likely part of why "lobby creation sometimes doesn't work" from their side. **Rec**: add a room name/"Create room" field on the landing.
4. **Sudoku numpad looks dead until a cell is selected** (med). Mobile screenshot: the 1–9 pad is greyed with no explanation; first-timers may think it's broken. **Rec**: a one-line hint ("Pick a cell, then a number") or keep the pad visually active and only no-op taps. Active-voice, one job.
5. **Deep-link asymmetry** (low). `?game=cards` is honored but `?game=sudoku|wordle` fall through to the landing (`App.tsx` `getInitialGame`). Inconsistent; either honor all three or none.

## Design direction (low — not bugs)
6. **Hero isn't the thesis.** The landing is a competent but generic 3-equal-card grid. The product's distinctive value is *real-time co-op + live presence* (shared board, colored cursors, initials) — that's the memorable signature and it's absent from the hero. **Rec**: lead with a live/presence motif (e.g., animated shared cursors on a mini board) instead of three equal cards. Everything else stays quiet — spend boldness in one place.
7. **Typography** — the heavy black display ("Sudoku"/"Wordle"/"She's a 2") has real personality and is used consistently. Keep. No change.

## Quality floor — verified good
- Responsive: mobile (390px) stacks board → numpad → players → chat cleanly, no horizontal scroll.
- Accessibility: board is a proper `role="grid"` with per-cell labels; numpad/difficulty are labeled groups; swatches are labeled radios/buttons. Good empty states ("No messages yet. Say hi! 👋", "Add at least two players to start").
- Micro-interaction: RoomBadge "invite" → "copied!" flip is a nice touch.

## Not verified (backlog)
- `prefers-reduced-motion` honored? (flash animation on cell fill) — confirm.
- Contrast of disabled numpad text on light bg.
