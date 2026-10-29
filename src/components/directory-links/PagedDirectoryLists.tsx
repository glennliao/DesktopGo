import { useMemo, type ReactNode } from 'react'
import { FolderOpen, LayoutGrid, Plus } from 'lucide-react'
import type { DesktopIcon } from '../../types'
import { translate, useI18n } from '../../lib/i18n'
import { useIconStore } from '../../stores/iconStore'
import { Button } from '../ui/button'
import { DirectoryContentsView } from './DirectoryContentsView'
import { DIRECTORY_CREATE_LIST_EVENT } from './domain'
import { useDirectoryLists } from './useDirectoryLists'
import { hydrateLayout } from '../icon-grid/services/layoutStore'
import { getId } from '../icon-grid/model'

export function PagedDirectoryLists({
  children,
  icons,
  resetToken,
  disabled,
  addDisabled,
}: {
  children: (content?: ReactNode) => ReactNode
  icons: DesktopIcon[]
  resetToken: number
  disabled: boolean
  addDisabled: boolean
}) {
  useI18n()
  const { layout, error, retry, resizeFolder } = useDirectoryLists(resetToken)
  const activeId = useIconStore(state => state.activeDirectoryListId)
  const select = useIconStore(state => state.setActiveDirectoryListId)
  const groups = useMemo(
    () => layout?.scrollGroups?.filter(group => group.directory) ?? [],
    [layout]
  )
  const selected = groups.find(group => group.id === activeId)
  const selectedId = selected?.id ?? ''
  const manualItems = useMemo(() => {
    const hydrated = hydrateLayout(icons, layout)
    const group = hydrated.layout?.scrollGroups?.find(group => group.id === activeId)
    const byId = new Map(hydrated.items.map(item => [getId(item), item]))
    return group?.itemIds.flatMap(id => (byId.has(id) ? [byId.get(id)!] : [])) ?? []
  }, [icons, layout, activeId])
  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col"
      style={{ pointerEvents: disabled ? 'none' : undefined }}
    >
      <nav
        aria-label={translate('列表')}
        data-no-window-drag="true"
        className="absolute left-6 right-6 top-20 z-20 flex items-center justify-center gap-2"
      >
        <div className="search-control-group flex max-w-full items-center gap-1 overflow-x-auto rounded-lg p-1">
          {[{ id: '', name: translate('快捷入口'), directory: undefined }, ...groups].map(group => (
            <Button
              key={group.id}
              variant={group.id === selectedId ? 'secondary' : 'ghost'}
              size="sm"
              className="max-w-48 shrink-0 gap-1.5"
              aria-pressed={group.id === selectedId}
              title={group.directory?.rootPath}
              onClick={() => select(group.id || null)}
            >
              {group.directory ? (
                <FolderOpen className="h-4 w-4 shrink-0" />
              ) : (
                <LayoutGrid className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{group.name}</span>
            </Button>
          ))}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label={translate('添加关联列表')}
            disabled={addDisabled}
            onClick={() => window.dispatchEvent(new Event(DIRECTORY_CREATE_LIST_EVENT))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {error ? (
          <Button size="sm" variant="outline" onClick={retry}>
            {translate('加载列表失败，重试')}
          </Button>
        ) : null}
      </nav>
      {children(
        selected?.directory ? (
          <DirectoryContentsView
            key={selected.id + selected.directory.rootPath}
            link={selected.directory}
            name={selected.name}
            presentation="paged"
            manualItems={manualItems}
            onFolderResize={(path, size) => resizeFolder(selected.id, path, size)}
          />
        ) : undefined
      )}
    </div>
  )
}
