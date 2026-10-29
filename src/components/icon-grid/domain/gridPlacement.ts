import { getGridItemSpan, type GridItem } from '../model'
import type { PageAnchorEntry } from './topLevelLayout'

export const placeGridItems = (
  itemIds: string[],
  itemById: ReadonlyMap<string, GridItem>,
  columns: number,
  reservedEntries: PageAnchorEntry[] = [],
  pageRows?: number
): PageAnchorEntry[] => {
  const minimumColumns = itemIds.reduce((maximum, id) => {
    const item = itemById.get(id)
    return item ? Math.max(maximum, getGridItemSpan(item).cols) : maximum
  }, 1)
  const safeColumns = Math.max(minimumColumns, Math.floor(columns))
  const occupiedCells = new Set<number>()
  const nextAnchorBySpan = new Map<string, number>()
  const reservedIds = new Set<string>()
  const entries: PageAnchorEntry[] = []

  reservedEntries.forEach(entry => {
    if (reservedIds.has(entry.id)) return
    reservedIds.add(entry.id)
    entries.push(entry)
    for (let rowOffset = 0; rowOffset < entry.span.rows; rowOffset += 1) {
      for (let colOffset = 0; colOffset < entry.span.cols; colOffset += 1) {
        occupiedCells.add((entry.row + rowOffset) * safeColumns + entry.col + colOffset)
      }
    }
  })

  itemIds.forEach(id => {
    if (reservedIds.has(id)) return
    const item = itemById.get(id)
    if (!item) return
    const rawSpan = getGridItemSpan(item)
    const span = {
      cols: Math.max(1, rawSpan.cols),
      rows: Math.max(1, rawSpan.rows),
    }
    const spanKey = `${span.cols}x${span.rows}`
    // Occupancy only grows: earlier rejected anchors cannot become available later.
    let anchorIndex = nextAnchorBySpan.get(spanKey) ?? 0

    while (true) {
      const row = Math.floor(anchorIndex / safeColumns)
      const col = anchorIndex % safeColumns
      if (pageRows && (row % pageRows) + span.rows > pageRows) {
        anchorIndex += (pageRows - (row % pageRows)) * safeColumns - col
        continue
      }
      if (col + span.cols > safeColumns) {
        anchorIndex += safeColumns - col
        continue
      }

      const footprint: number[] = []
      for (let rowOffset = 0; rowOffset < span.rows; rowOffset += 1) {
        for (let colOffset = 0; colOffset < span.cols; colOffset += 1) {
          footprint.push((row + rowOffset) * safeColumns + col + colOffset)
        }
      }
      if (footprint.every(cell => !occupiedCells.has(cell))) {
        nextAnchorBySpan.set(spanKey, anchorIndex + 1)
        footprint.forEach(cell => occupiedCells.add(cell))
        entries.push({
          id,
          item,
          globalIndex: anchorIndex,
          localIndex: anchorIndex,
          row,
          col,
          span,
        })
        break
      }
      anchorIndex += 1
    }
  })

  return entries.sort((a, b) => a.row - b.row || a.col - b.col)
}
