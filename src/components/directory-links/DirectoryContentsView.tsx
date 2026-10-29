import { useMemo, useState, type ReactNode, type RefObject } from 'react'
import { ArrowLeft, FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'
import { getIntlLocale, translate, useI18n } from '../../lib/i18n'
import {
  directoryAncestors,
  directoryDisplayName,
  sortDirectoryEntries,
  type DirectoryLink,
} from './domain'
import { useDirectoryContents } from './useDirectoryContents'
import { DirectoryGrid, type ViewPosition } from './DirectoryGrid'
import type { FolderSize, GridItem } from '../icon-grid/model'

const ERROR_MESSAGES: Record<string, string> = {
  not_found: '目录不存在',
  access_denied: '无法读取目录',
  not_directory: '路径不是目录',
  outside_root: '无法进入关联目录之外的位置',
  directory_cycle: '目录链接形成循环',
  unsupported_version: '此关联需要更新版本的应用',
  io_error: '无法读取目录',
}

interface DirectoryContentsProps {
  link: DirectoryLink
  name: string
  initialPath?: string
  manualContent?: ReactNode
  onNavigate?: (path: string) => void
  presentation?: 'paged' | 'scroll'
  scrollHost?: RefObject<HTMLDivElement | null>
  manualItems?: GridItem[]
  onFolderResize?: (path: string, size: FolderSize) => void
}

export function DirectoryContentsView({
  link,
  name,
  initialPath = '',
  manualContent,
  onNavigate,
  presentation = 'scroll',
  scrollHost,
  manualItems = [],
  onFolderResize,
}: DirectoryContentsProps) {
  useI18n()
  const [relativePath, setRelativePath] = useState(initialPath)
  const [positions, setPositions] = useState<Record<string, ViewPosition>>({})
  const { entries, loading, error, refresh } = useDirectoryContents(link, relativePath)
  const locale = getIntlLocale()
  const sorted = useMemo(() => sortDirectoryEntries(entries, locale), [entries, locale])
  const ancestors = directoryAncestors(relativePath)
  const navigate = (path: string) => {
    setRelativePath(path)
    onNavigate?.(path)
  }
  const back = () => navigate(ancestors[ancestors.length - 2] ?? '')
  return (
    <section
      data-directory-contents
      data-no-window-drag="true"
      className={`min-w-0 ${presentation === 'paged' ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-3'}`}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => {
        if (relativePath && event.altKey && event.key === 'ArrowLeft') {
          event.preventDefault()
          event.stopPropagation()
          back()
        }
      }}
    >
      <nav
        aria-label={translate('目录路径')}
        className="flex min-w-0 shrink-0 items-center gap-1 text-sm"
      >
        {relativePath ? (
          <Button size="sm" variant="ghost" aria-label={translate('返回上一级')} onClick={back}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <div
          className="flex min-w-0 flex-1 items-center overflow-x-auto"
          title={link.rootPath + (relativePath ? '/' + relativePath : '')}
        >
          {ancestors.map(path =>
            path === relativePath ? (
              <span
                key={path}
                className="shrink-0 px-1.5 py-1 text-foreground"
                aria-current="location"
              >
                {path ? '/ ' + directoryDisplayName(path) : name}
              </span>
            ) : (
              <button
                key={path}
                type="button"
                className="shrink-0 rounded px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigate(path)}
              >
                {path ? '/ ' + directoryDisplayName(path) : name}
              </button>
            )
          )}
        </div>
        <Button size="sm" variant="ghost" aria-label={translate('刷新')} onClick={refresh}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </nav>
      {!relativePath ? manualContent : null}
      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
        >
          <span>{translate(ERROR_MESSAGES[error] ?? '无法读取目录')}</span>
          <Button size="sm" variant="outline" onClick={refresh}>
            {translate('重试')}
          </Button>
        </div>
      ) : null}
      {entries.length || (!relativePath && manualItems.length) ? (
        <DirectoryGrid
          key={relativePath}
          entries={sorted}
          link={link}
          onEnter={navigate}
          initialPosition={positions[relativePath]}
          focusOnMount={Boolean(relativePath || positions[relativePath])}
          presentation={presentation}
          scrollHost={scrollHost}
          manualItems={relativePath ? [] : manualItems}
          onFolderResize={onFolderResize}
          onRemember={position =>
            setPositions(previous => ({ ...previous, [relativePath]: position }))
          }
        />
      ) : !error ? (
        <div
          role="status"
          className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <FolderOpen className="h-4 w-4" />
          {translate(loading ? '正在读取目录…' : '目录为空')}
        </div>
      ) : null}
    </section>
  )
}
