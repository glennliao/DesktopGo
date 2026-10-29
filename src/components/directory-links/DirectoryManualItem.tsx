import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGroup } from 'framer-motion'
import { Icon } from '../Icon'
import type { GridItem, GridSpan } from '../icon-grid/model'
import { OuterFolderTile } from '../icon-grid/views/OuterFolderTile'
import { FolderPanel } from '../icon-grid/views/FolderPanel'
import {
  FOLDER_MODAL_MAX_HEIGHT,
  FOLDER_MODAL_MAX_WIDTH,
} from '../icon-grid/views/folderVisualPolicy'
import { useIconStore } from '../../stores/iconStore'
import { ICON_SIZE_CONFIG, getIconGridRowHeight } from '../../types'
import { DirectoryContentsView } from './DirectoryContentsView'
import { useDirectoryActions } from './directoryActions'

/** Manual members of a linked list remain launchable in its paged presentation. */
export function DirectoryManualItem({ item, span }: { item: GridItem; span: GridSpan }) {
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const iconSize = useIconStore(state => state.iconSize)
  const launch = useIconStore(state => state.launchApp)
  const config = ICON_SIZE_CONFIG[iconSize]
  const requested = useDirectoryActions()?.folderOpenPath
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  const icon = (member: Extract<GridItem, { kind: 'icon' }>) => (
    <Icon
      key={member.key}
      icon={member.icon}
      selectionKey={member.key}
      selectionMode={false}
      selected={false}
      onToggleSelect={() => {}}
      onActivate={() => void launch(member.icon.path)}
      contextMenu={element => element}
    />
  )
  if (item.kind === 'icon') return icon(item)
  const children = (
    <div
      className="grid content-start justify-items-center gap-2"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${config.containerWidth}px, 1fr))` }}
    >
      {item.children.map(icon)}
    </div>
  )
  return (
    <LayoutGroup>
      <OuterFolderTile
        folder={item}
        span={span}
        slotWidth={config.containerWidth}
        slotHeight={getIconGridRowHeight(iconSize)}
        gridGap={8}
        folderPreview={false}
        folderOpen={open}
        sharedLayoutActive={false}
        selectionMode={false}
        readOnly
        onPointerDown={event => event.stopPropagation()}
        onClickCapture={() => {}}
        onOpenFolder={() => setOpen(true)}
        onLaunchIcon={path => void launch(path)}
        onDissolveFolder={() => {}}
      />
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <FolderPanel
                folder={item}
                activeFolderSharedLayoutId={null}
                folderPanelRef={panel}
                width={FOLDER_MODAL_MAX_WIDTH}
                maxModalHeight={FOLDER_MODAL_MAX_HEIGHT}
                onClose={() => setOpen(false)}
                onBackdropClose={event => {
                  event.stopPropagation()
                  if (event.target === event.currentTarget) setOpen(false)
                }}
                onPanelPointerDown={event => event.stopPropagation()}
                onPanelClick={event => event.stopPropagation()}
              >
                {item.directory ? (
                  <DirectoryContentsView
                    key={requested?.sequence ?? 0}
                    link={item.directory}
                    name={item.name}
                    initialPath={requested?.folderId === item.id ? requested.path : ''}
                    manualItems={item.children}
                  />
                ) : (
                  <div className="max-h-[52vh] overflow-auto">{children}</div>
                )}
              </FolderPanel>
            </div>,
            document.body
          )
        : null}
    </LayoutGroup>
  )
}
