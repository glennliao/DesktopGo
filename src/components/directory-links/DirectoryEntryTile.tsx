import { FolderOpen, Play } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { Icon } from '../Icon'
import { OuterFolderTile } from '../icon-grid/views/OuterFolderTile'
import type { FolderSize, GridItem, GridSpan } from '../icon-grid/model'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu'
import { translate } from '../../lib/i18n'
import type { DirectoryEntry } from './domain'

export function DirectoryEntryTile({
  entry,
  item,
  span,
  tileWidth,
  tileHeight,
  icon,
  onEnter,
  onLaunch,
  onResize,
  preferredSize,
}: {
  entry: DirectoryEntry
  item: GridItem
  span: GridSpan
  tileWidth: number
  tileHeight: number
  icon: string
  onEnter: (relativePath: string) => void
  onLaunch: (path: string) => void
  onResize?: (size: FolderSize) => void
  preferredSize?: FolderSize
}) {
  const reveal = () =>
    void invoke('launch_app', {
      path: entry.isDirectory ? entry.path : entry.path.replace(/[\\/][^\\/]+$/, ''),
    })
  if (item.kind === 'folder')
    return (
      <OuterFolderTile
        folder={item}
        span={span}
        slotWidth={tileWidth}
        slotHeight={tileHeight}
        gridGap={8}
        folderPreview={false}
        folderOpen={false}
        sharedLayoutActive={false}
        selectionMode={false}
        readOnly
        preferredSize={preferredSize}
        onPointerDown={event => event.stopPropagation()}
        onClickCapture={() => {}}
        onOpenFolder={() => onEnter(entry.relativePath)}
        directoryRelativePath={entry.relativePath}
        onOpenDirectory={path => onEnter(path || entry.relativePath)}
        onRevealFolder={reveal}
        onLaunchIcon={onLaunch}
        onResizeFolder={onResize ? (_id, size) => onResize(size) : undefined}
        onDissolveFolder={() => {}}
      />
    )
  const activate = () => onLaunch(entry.path)
  return (
    <Icon
      icon={{ ...item.icon, icon_base64: icon }}
      selectionKey={item.key}
      selectionMode={false}
      selected={false}
      onToggleSelect={() => {}}
      onActivate={activate}
      contextMenu={element => (
        <ContextMenu>
          <ContextMenuTrigger asChild>{element}</ContextMenuTrigger>
          <ContextMenuContent className="w-56 p-1 shadow-xl">
            <ContextMenuItem className="gap-2 px-2.5 py-2" onSelect={activate}>
              <Play className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {translate('打开')}
            </ContextMenuItem>
            <ContextMenuItem className="gap-2 px-2.5 py-2" onSelect={reveal}>
              <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {translate('在资源管理器中打开')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
    />
  )
}
