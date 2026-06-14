// A self-contained Sudoku engine: generation, solving, and validation.
// Boards are flat arrays of length 81 where 0 represents an empty cell.

export type Grid = number[]

export const SIZE = 9
export const CELLS = SIZE * SIZE

export function emptyGrid(): Grid {
  return new Array<number>(CELLS).fill(0)
}

export function rowOf(index: number): number {
  return Math.floor(index / SIZE)
}

export function colOf(index: number): number {
  return index % SIZE
}

export function boxOf(index: number): number {
  return Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3)
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Whether placing `val` at `index` keeps the grid valid (ignores the cell itself). */
export function canPlace(grid: Grid, index: number, val: number): boolean {
  const row = rowOf(index)
  const col = colOf(index)
  for (let i = 0; i < SIZE; i++) {
    if (i !== col && grid[row * SIZE + i] === val) return false
    if (i !== row && grid[i * SIZE + col] === val) return false
  }
  const br = Math.floor(row / 3) * 3
  const bc = Math.floor(col / 3) * 3
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = (br + r) * SIZE + (bc + c)
      if (idx !== index && grid[idx] === val) return false
    }
  }
  return true
}

function fillGrid(grid: Grid): boolean {
  const idx = grid.indexOf(0)
  if (idx === -1) return true
  for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(grid, idx, n)) {
      grid[idx] = n
      if (fillGrid(grid)) return true
      grid[idx] = 0
    }
  }
  return false
}

/** Counts solutions up to `limit` so we can cheaply check for uniqueness. */
function countSolutions(grid: Grid, limit = 2): number {
  const idx = grid.indexOf(0)
  if (idx === -1) return 1
  let count = 0
  for (let n = 1; n <= 9; n++) {
    if (canPlace(grid, idx, n)) {
      grid[idx] = n
      count += countSolutions(grid, limit)
      grid[idx] = 0
      if (count >= limit) break
    }
  }
  return count
}

export type Difficulty = 'easy' | 'medium' | 'hard'

const CLUES_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 42,
  medium: 32,
  hard: 26,
}

export interface GeneratedPuzzle {
  puzzle: Grid
  solution: Grid
}

/** Generates a puzzle with a unique solution for the given difficulty. */
export function generatePuzzle(difficulty: Difficulty): GeneratedPuzzle {
  const solution = emptyGrid()
  fillGrid(solution)

  const puzzle = solution.slice()
  const targetClues = CLUES_BY_DIFFICULTY[difficulty]
  const cellsToRemove = CELLS - targetClues

  let removed = 0
  for (const idx of shuffle([...Array(CELLS).keys()])) {
    if (removed >= cellsToRemove) break
    if (puzzle[idx] === 0) continue
    const backup = puzzle[idx]
    puzzle[idx] = 0
    // Only keep the removal if the puzzle still has exactly one solution.
    if (countSolutions(puzzle.slice(), 2) !== 1) {
      puzzle[idx] = backup
    } else {
      removed++
    }
  }

  return { puzzle, solution }
}

/** Indices that currently break a Sudoku rule (duplicate in row/col/box). */
export function findConflicts(values: Grid): Set<number> {
  const conflicts = new Set<number>()
  const check = (indices: number[]) => {
    const seen = new Map<number, number[]>()
    for (const idx of indices) {
      const v = values[idx]
      if (v === 0) continue
      const list = seen.get(v) ?? []
      list.push(idx)
      seen.set(v, list)
    }
    for (const list of seen.values()) {
      if (list.length > 1) for (const idx of list) conflicts.add(idx)
    }
  }

  for (let i = 0; i < SIZE; i++) {
    const row: number[] = []
    const col: number[] = []
    for (let j = 0; j < SIZE; j++) {
      row.push(i * SIZE + j)
      col.push(j * SIZE + i)
    }
    check(row)
    check(col)
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box: number[] = []
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          box.push((br * 3 + r) * SIZE + (bc * 3 + c))
        }
      }
      check(box)
    }
  }
  return conflicts
}

/** A board is solved when it is completely filled with no rule conflicts. */
export function isSolved(values: Grid): boolean {
  if (values.some((v) => v === 0)) return false
  return findConflicts(values).size === 0
}
