import { useMemo } from 'react'

import { SIZE, boxOf, colOf, rowOf } from '../../shared/sudoku'
import type { Player } from '../../shared/protocol'
import { initials, readableText } from '../lib/colors'

interface BoardProps {
  values: number[]
  given: boolean[]
  conflicts: Set<number>
  selected: number | null
  players: Player[]
  selfId: string | null
  flashing: ReadonlySet<number>
  onSelect: (index: number) => void
  onFill: (index: number, value: number) => void
}

export function Board({
  values,
  given,
  conflicts,
  selected,
  players,
  selfId,
  flashing,
  onSelect,
  onFill,
}: BoardProps) {
  // Map cell index -> other players whose cursor is on that cell.
  const presence = useMemo(() => {
    const map = new Map<number, Player[]>()
    for (const p of players) {
      if (p.id === selfId || p.cursor === null) continue
      const list = map.get(p.cursor) ?? []
      list.push(p)
      map.set(p.cursor, list)
    }
    return map
  }, [players, selfId])

  const selectedValue = selected !== null ? values[selected] : 0

  function move(index: number, dr: number, dc: number) {
    let r = rowOf(index) + dr
    let c = colOf(index) + dc
    r = Math.max(0, Math.min(SIZE - 1, r))
    c = Math.max(0, Math.min(SIZE - 1, c))
    onSelect(r * SIZE + c)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (selected === null) return
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        move(selected, -1, 0)
        break
      case 'ArrowDown':
        e.preventDefault()
        move(selected, 1, 0)
        break
      case 'ArrowLeft':
        e.preventDefault()
        move(selected, 0, -1)
        break
      case 'ArrowRight':
        e.preventDefault()
        move(selected, 0, 1)
        break
      case 'Backspace':
      case 'Delete':
      case '0':
        e.preventDefault()
        if (!given[selected]) onFill(selected, 0)
        break
      default:
        if (/^[1-9]$/.test(e.key)) {
          e.preventDefault()
          if (!given[selected]) onFill(selected, Number(e.key))
        }
    }
  }

  return (
    <div
      className="board"
      role="grid"
      aria-label="Sudoku board"
      onKeyDown={handleKeyDown}
    >
      {Array.from({ length: SIZE }, (_, r) => (
        <div className="board-row" role="row" key={r}>
          {Array.from({ length: SIZE }, (_, c) => {
            const index = r * SIZE + c
            const value = values[index]
            const isGiven = given[index]
            const isSelected = selected === index
            const isConflict = conflicts.has(index)
            const sameValue =
              selectedValue !== 0 && value === selectedValue && !isSelected
            const related =
              selected !== null &&
              !isSelected &&
              (rowOf(index) === rowOf(selected) ||
                colOf(index) === colOf(selected) ||
                boxOf(index) === boxOf(selected))
            const others = presence.get(index)

            const classes = [
              'cell',
              isGiven ? 'cell-given' : 'cell-input',
              isSelected ? 'cell-selected' : '',
              isConflict ? 'cell-conflict' : '',
              sameValue ? 'cell-same' : '',
              related ? 'cell-related' : '',
              flashing.has(index) ? 'cell-flash' : '',
              c % 3 === 2 && c !== SIZE - 1 ? 'cell-border-right' : '',
              r % 3 === 2 && r !== SIZE - 1 ? 'cell-border-bottom' : '',
            ]
              .filter(Boolean)
              .join(' ')

            const label = `Row ${r + 1}, column ${c + 1}, ${
              value === 0 ? 'empty' : value
            }${isGiven ? ', clue' : ''}`

            return (
              <button
                type="button"
                key={index}
                role="gridcell"
                aria-label={label}
                aria-selected={isSelected}
                aria-readonly={isGiven}
                tabIndex={isSelected || (selected === null && index === 0) ? 0 : -1}
                className={classes}
                onClick={() => onSelect(index)}
                style={
                  others && others.length > 0
                    ? { boxShadow: `inset 0 0 0 2px ${others[0].color}` }
                    : undefined
                }
              >
                {value !== 0 ? value : ''}
                {others && others.length > 0 && (
                  <span className="cell-presence" aria-hidden="true">
                    {others.slice(0, 2).map((p) => (
                      <span
                        key={p.id}
                        className="presence-badge"
                        title={p.name}
                        style={{
                          background: p.color,
                          color: readableText(p.color),
                        }}
                      >
                        {initials(p.name)}
                      </span>
                    ))}
                    {others.length > 2 && (
                      <span className="presence-badge presence-more">
                        +{others.length - 2}
                      </span>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
