import { getGridItemSpan, getId, type FolderSize, type GridItem } from '../icon-grid/model'
import { getPageAnchorEntries, type PageAnchorEntry } from '../icon-grid/domain/topLevelLayout'
import { placeGridItems } from '../icon-grid/domain/gridPlacement'
import {
  directoryEntryId,
  directoryFolderSize,
  type DirectoryEntry,
  type DirectoryLink,
} from './domain'

/** Directory models are presentation data; they never enter the saved manual layout. */
export function directoryEntryGridItem(link: DirectoryLink, entry: DirectoryEntry): GridItem {
  const key = directoryEntryId(link.rootPath, entry)
  if (entry.isDirectory && entry.canEnter)
    return {
      kind: 'folder',
      id: key,
      name: entry.name,
      size: directoryFolderSize(link, entry.relativePath),
      children: [],
      directory: link,
    }
  return {
    kind: 'icon',
    key,
    icon: {
      id: key,
      name: entry.name,
      path: entry.path,
      target_path: entry.path,
      icon_base64: '',
      item_type: entry.isDirectory ? 'folder' : 'file',
      origin: 'import',
    },
  }
}

export function directoryGridLayout({
  items,
  width,
  height,
  tileWidth,
  rowHeight,
  paged,
}: {
  items: GridItem[]
  width: number
  height: number
  tileWidth: number
  rowHeight: number
  paged: boolean
}) {
  const columns = Math.max(1, Math.floor((width + 8) / (tileWidth + 8)))
  const rowsPerPage = Math.max(1, Math.floor((height + 8) / rowHeight))
  const pageSize = columns * rowsPerPage
  const fitted = items.map(item => {
    if (item.kind !== 'folder') return item
    const span = getGridItemSpan(item)
    const size =
      `${Math.min(span.cols, columns)}x${Math.min(span.rows, paged ? rowsPerPage : 2)}` as FolderSize
    return size === item.size ? item : { ...item, size }
  })
  const byId = new Map(fitted.map(item => [getId(item), item]))
  const entries = placeGridItems(
    fitted.map(getId),
    byId,
    columns,
    [],
    paged ? rowsPerPage : undefined
  )
  const totalRows = entries.reduce((max, entry) => Math.max(max, entry.row + entry.span.rows), 0)
  if (!paged)
    return { columns, items: fitted, slots: null, entries, pageSize, pageCount: 1, totalRows }
  const pageCount = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const slots: Array<string | null> = Array.from({ length: pageCount * pageSize }, () => null)
  entries.forEach(entry => {
    slots[entry.globalIndex] = entry.id
  })
  return {
    columns,
    items: fitted,
    slots,
    entries: [],
    pageSize,
    pageCount,
    totalRows: rowsPerPage,
  }
}

export function directoryGridWindow({
  layout,
  page,
  top,
  height,
  rowHeight,
  paged,
}: {
  layout: ReturnType<typeof directoryGridLayout>
  page: number
  top: number
  height: number
  rowHeight: number
  paged: boolean
}) {
  const pageCount = layout.pageCount
  const currentPage = Math.max(0, Math.min(page, pageCount - 1))
  const startRow = Math.max(0, Math.floor(top / rowHeight) - 2)
  const endRow = Math.ceil((top + height) / rowHeight) + 2
  const visible: PageAnchorEntry[] = paged
    ? getPageAnchorEntries(
        layout.slots ?? [],
        layout.items,
        currentPage,
        layout.pageSize,
        layout.columns
      )
    : layout.entries.filter(entry => entry.row + entry.span.rows > startRow && entry.row < endRow)
  return { pageCount, currentPage, visible }
}
