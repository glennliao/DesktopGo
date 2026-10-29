import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { NativeScrollArea } from '../ui/native-scroll-area'
import { translate } from '../../lib/i18n'
import { useIconStore } from '../../stores/iconStore'
import { ICON_SIZE_CONFIG, getIconGridRowHeight } from '../../types'
import { useVisibleSearchIcons } from '../search/useVisibleSearchIcons'
import { GridPageDots } from '../icon-grid/views/GridPageDots'
import { getId, type FolderSize, type GridItem } from '../icon-grid/model'
import { DirectoryManualItem } from './DirectoryManualItem'
import { directoryEntryId, type DirectoryEntry, type DirectoryLink } from './domain'
import { directoryEntryGridItem, directoryGridLayout, directoryGridWindow } from './gridWindow'
import { DirectoryEntryTile } from './DirectoryEntryTile'
import { WHEEL_PAGE_COOLDOWN_MS, WHEEL_PAGE_DELTA_THRESHOLD } from '../icon-grid/constants'

export interface ViewPosition {
  scrollTop: number
  focusedEntryId?: string
  page?: number
}

export function DirectoryGrid({
  entries,
  link,
  onEnter,
  initialPosition,
  focusOnMount,
  onRemember,
  presentation = 'scroll',
  scrollHost,
  manualItems = [],
  onFolderResize,
}: {
  entries: DirectoryEntry[]
  link: DirectoryLink
  onEnter: (path: string) => void
  initialPosition?: ViewPosition
  focusOnMount: boolean
  onRemember: (position: ViewPosition) => void
  presentation?: 'paged' | 'scroll'
  scrollHost?: RefObject<HTMLDivElement | null>
  manualItems?: GridItem[]
  onFolderResize?: (path: string, size: FolderSize) => void
}) {
  const { iconSize, launchApp } = useIconStore()
  const config = ICON_SIZE_CONFIG[iconSize]
  const rowHeight = getIconGridRowHeight(iconSize) + 8
  const viewport = useRef<HTMLDivElement>(null)
  const [restoredPosition] = useState(initialPosition)
  const [restoreFocus] = useState(focusOnMount)
  const [page, setPage] = useState(initialPosition?.page ?? 0)
  const wheel = useRef({ delta: 0, until: 0 })
  const [metrics, setMetrics] = useState({
    width: 400,
    height: 360,
    top: initialPosition?.scrollTop ?? 0,
  })
  useEffect(() => {
    const node = viewport.current
    if (!node) return
    const host = scrollHost?.current ?? node
    const offset = () =>
      node.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop
    host.scrollTo({
      top: restoredPosition ? restoredPosition.scrollTop + (scrollHost ? offset() : 0) : 0,
    })
    const frame = requestAnimationFrame(() => {
      if (!restoreFocus) return
      const target = Array.from(
        node.querySelectorAll<HTMLElement>('[data-directory-entry-id]')
      ).find(item => item.dataset.directoryEntryId === restoredPosition?.focusedEntryId)
      if (target) target.focus({ preventScroll: true })
      else node.focus({ preventScroll: true })
    })
    const measure = () =>
      setMetrics({
        width: node.clientWidth,
        height: host.clientHeight,
        top: Math.max(0, host.scrollTop - (scrollHost ? offset() : 0)),
      })
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    if (host !== node) observer.observe(host)
    host.addEventListener('scroll', measure, { passive: true })
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      host.removeEventListener('scroll', measure)
    }
  }, [restoredPosition, restoreFocus, scrollHost])
  const sources = useMemo(() => {
    const byId = new Map<string, { item: GridItem; entry?: DirectoryEntry }>()
    manualItems.forEach(item => byId.set(getId(item), { item }))
    entries.forEach(entry => {
      const item = directoryEntryGridItem(link, entry)
      byId.set(getId(item), { item, entry })
    })
    return byId
  }, [entries, manualItems, link])
  const items = useMemo(() => Array.from(sources.values(), source => source.item), [sources])
  const paged = presentation === 'paged'
  const layout = useMemo(
    () =>
      directoryGridLayout({
        items,
        width: metrics.width,
        height: metrics.height,
        tileWidth: config.containerWidth,
        rowHeight,
        paged,
      }),
    [items, metrics.width, metrics.height, config.containerWidth, rowHeight, paged]
  )
  const { pageCount, currentPage, visible } = directoryGridWindow({
    layout,
    page,
    top: metrics.top,
    height: metrics.height,
    rowHeight,
    paged,
  })
  const requests = useMemo(
    () =>
      visible.flatMap(placed =>
        placed.item.kind === 'icon'
          ? [{ path: placed.item.icon.path, isFolder: placed.item.icon.item_type === 'folder' }]
          : []
      ),
    [visible]
  )
  const iconFor = useVisibleSearchIcons(requests, true)
  const enter = (entry: DirectoryEntry, path: string) => {
    onRemember({
      scrollTop: metrics.top,
      page: currentPage,
      focusedEntryId: directoryEntryId(link.rootPath, entry),
    })
    onEnter(path)
  }
  const grid = (
    <div
      ref={viewport}
      tabIndex={0}
      className={
        presentation === 'paged'
          ? 'min-h-0 flex-1 overflow-hidden'
          : scrollHost
            ? 'min-h-24'
            : 'min-h-24 overflow-auto'
      }
      style={
        presentation === 'scroll' && !scrollHost ? { maxHeight: 'min(52vh, 480px)' } : undefined
      }
    >
      <div
        className="relative mx-auto max-w-full"
        style={{
          width: layout.columns * (config.containerWidth + 8) - 8,
          height: paged ? '100%' : Math.max(0, layout.totalRows * rowHeight - 8),
        }}
      >
        {visible.map(placed => {
          const source = sources.get(placed.id)!
          return (
            <div
              key={placed.id}
              tabIndex={-1}
              data-directory-entry-id={
                source.entry ? directoryEntryId(link.rootPath, source.entry) : undefined
              }
              className="absolute rounded-icon-tile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              style={{
                top: placed.row * rowHeight,
                left: placed.col * (config.containerWidth + 8),
                width: placed.span.cols * (config.containerWidth + 8) - 8,
                height: placed.span.rows * rowHeight - 8,
              }}
            >
              {source.entry ? (
                <DirectoryEntryTile
                  entry={source.entry}
                  item={placed.item}
                  preferredSize={source.item.kind === 'folder' ? source.item.size : undefined}
                  onResize={
                    onFolderResize
                      ? size => onFolderResize(source.entry!.relativePath, size)
                      : undefined
                  }
                  span={placed.span}
                  tileWidth={config.containerWidth}
                  tileHeight={rowHeight - 8}
                  icon={
                    placed.item.kind === 'icon'
                      ? iconFor(source.entry.path, source.entry.isDirectory)
                      : ''
                  }
                  onEnter={path => enter(source.entry!, path)}
                  onLaunch={path => void launchApp(path)}
                />
              ) : (
                <DirectoryManualItem item={placed.item} span={placed.span} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
  if (presentation === 'scroll')
    return scrollHost ? grid : <NativeScrollArea asChild>{grid}</NativeScrollArea>
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3"
      onWheel={event => {
        event.stopPropagation()
        if (pageCount <= 1 || event.ctrlKey || performance.now() < wheel.current.until) return
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
        if (Math.sign(delta) !== Math.sign(wheel.current.delta)) wheel.current.delta = 0
        wheel.current.delta += delta
        if (Math.abs(wheel.current.delta) < WHEEL_PAGE_DELTA_THRESHOLD) return
        setPage(Math.max(0, Math.min(pageCount - 1, currentPage + Math.sign(wheel.current.delta))))
        wheel.current = { delta: 0, until: performance.now() + WHEEL_PAGE_COOLDOWN_MS }
      }}
      onKeyDown={event => {
        if (event.key !== 'PageDown' && event.key !== 'PageUp') return
        event.preventDefault()
        event.stopPropagation()
        setPage(
          Math.max(0, Math.min(pageCount - 1, currentPage + (event.key === 'PageDown' ? 1 : -1)))
        )
      }}
    >
      {grid}
      <nav
        aria-label={translate('分页')}
        data-pagination
        className="flex shrink-0 items-center justify-center gap-3"
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={translate('上一页')}
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <GridPageDots count={pageCount} current={currentPage} onChange={setPage} />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {currentPage + 1} / {pageCount}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={translate('下一页')}
          disabled={currentPage === pageCount - 1}
          onClick={() => setPage(currentPage + 1)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </nav>
    </div>
  )
}
