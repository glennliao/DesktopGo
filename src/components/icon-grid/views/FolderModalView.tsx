import { DirectoryContentsView } from '../../directory-links/DirectoryContentsView'
import {
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import { Icon } from '../../Icon'
import { DRAG_HOLE_ID } from '../domain/slots'
import type { FolderItem, IconItem } from '../model'
import { NativeScrollArea } from '@/components/ui/native-scroll-area'
import { FolderPanel } from './FolderPanel'
import { useDirectoryActions } from '../../directory-links/directoryActions'

export interface FolderModalViewProps {
  openFolder: FolderItem | null
  activeFolderSharedLayoutId: string | null
  dragContext: 'outer' | 'folder' | null
  selectionMode: boolean
  selectedSet: Set<string>
  hiddenItemIds: Set<string>
  onToggleSelectIcon: (key: string) => void
  folderPanelRef: RefObject<HTMLDivElement | null>
  folderGridContainerRef: RefObject<HTMLDivElement | null>
  folderGridRef: RefObject<HTMLDivElement | null>
  folderColumns: number
  folderItemWidth: number
  folderItemHeight: number
  folderRenderOrder: Array<string | null>
  folderItemById: Map<string, IconItem>
  bindFolderTileRef: (id: string, node: HTMLDivElement | null) => void
  onBackdropClose: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPanelPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPanelClick: (event: ReactMouseEvent<HTMLDivElement>) => void
  onClose: () => void
  onRenameFolder: (folderId: string, name: string) => void
  onActivateIcon: (icon: IconItem) => void
  onFolderTilePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    folderId: string,
    itemId: string
  ) => void
  onTileClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => void
  maxModalWidth: number
  maxModalHeight: number
}

export function FolderModalView({
  openFolder,
  activeFolderSharedLayoutId,
  dragContext,
  selectionMode,
  selectedSet,
  hiddenItemIds,
  onToggleSelectIcon,
  folderPanelRef,
  folderGridContainerRef,
  folderGridRef,
  folderColumns,
  folderItemWidth,
  folderItemHeight,
  folderRenderOrder,
  folderItemById,
  bindFolderTileRef,
  onBackdropClose,
  onPanelPointerDown,
  onPanelClick,
  onClose,
  onRenameFolder,
  onActivateIcon,
  onFolderTilePointerDown,
  onTileClickCapture,
  maxModalWidth,
  maxModalHeight,
}: FolderModalViewProps) {
  const folderId = openFolder?.id ?? ''
  const directoryActions = useDirectoryActions()
  const requested = directoryActions?.folderOpenPath
  const sequence = requested?.sequence ?? 0
  const [navigation, setNavigation] = useState({
    folderId: '',
    path: '',
    initialPath: '',
    sequence: 0,
  })
  if (navigation.folderId !== folderId || navigation.sequence !== sequence) {
    const path =
      requested?.folderId === folderId && navigation.sequence !== sequence ? requested.path : ''
    setNavigation({ folderId, path, initialPath: path, sequence })
  }
  const linked = Boolean(openFolder?.directory)
  const manualContent = openFolder ? (
    <NativeScrollArea asChild>
      <div
        ref={linked ? undefined : folderGridContainerRef}
        className={linked ? undefined : '-mr-5 overflow-auto pr-5'}
        style={linked ? undefined : { maxHeight: `calc(min(80vh, ${maxModalHeight}px) - 48px)` }}
      >
        <div
          ref={folderGridRef}
          className="grid content-start justify-items-center gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, folderColumns)}, ${folderItemWidth}px)`,
          }}
        >
          {folderRenderOrder.map((entry, index) => {
            if (entry === null || entry === DRAG_HOLE_ID) {
              const showDropSlot = entry === DRAG_HOLE_ID && dragContext === 'folder'
              return (
                <div
                  key={`folder-${showDropSlot ? 'drop' : 'empty'}-${index}`}
                  data-folder-grid-item
                  className={`h-full w-full rounded-icon-tile ${
                    showDropSlot
                      ? 'border border-border/60 bg-background/35 dark:border-white/20 dark:bg-white/8'
                      : 'border border-transparent bg-transparent'
                  }`}
                  style={{ minHeight: `${folderItemHeight}px` }}
                  aria-hidden="true"
                />
              )
            }

            const item = folderItemById.get(entry)
            if (!item) return null
            const hiddenItem = hiddenItemIds.has(entry)

            return (
              <div
                key={entry}
                ref={node => {
                  bindFolderTileRef(entry, node)
                }}
                data-folder-grid-item
                className={`relative touch-none transition-opacity duration-150 ${
                  hiddenItem ? 'pointer-events-none opacity-0' : 'opacity-100'
                }`}
                onPointerDown={event => onFolderTilePointerDown(event, openFolder.id, entry)}
                onClickCapture={onTileClickCapture}
                onClick={e => e.stopPropagation()}
              >
                <Icon
                  icon={item.icon}
                  selectionKey={item.key}
                  selectionMode={selectionMode}
                  selected={selectedSet.has(item.key)}
                  onToggleSelect={onToggleSelectIcon}
                  onActivate={() => onActivateIcon(item)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </NativeScrollArea>
  ) : null

  return (
    <FolderPanel
      folder={openFolder}
      activeFolderSharedLayoutId={activeFolderSharedLayoutId}
      folderPanelRef={folderPanelRef}
      width={Math.min(
        folderColumns * folderItemWidth + (folderColumns - 1) * 8 + 40,
        maxModalWidth
      )}
      maxModalHeight={maxModalHeight}
      onClose={onClose}
      onRename={
        openFolder && !(navigation.folderId === openFolder.id && navigation.path)
          ? name => onRenameFolder(openFolder.id, name)
          : undefined
      }
      onBackdropClose={onBackdropClose}
      onPanelPointerDown={onPanelPointerDown}
      onPanelClick={onPanelClick}
    >
      {openFolder?.directory ? (
        <NativeScrollArea asChild>
          <div
            ref={folderGridContainerRef}
            className="-mr-5 overflow-auto pr-5"
            style={{ maxHeight: `calc(min(80vh, ${maxModalHeight}px) - 48px)` }}
          >
            <DirectoryContentsView
              key={JSON.stringify([openFolder.id, openFolder.directory.rootPath, sequence])}
              link={openFolder.directory}
              name={openFolder.name}
              navigation="inline"
              onFolderResize={
                directoryActions
                  ? (path, size) =>
                      directoryActions.resizeDirectoryFolder('folder', openFolder.id, path, size)
                  : undefined
              }
              initialPath={navigation.initialPath}
              onNavigate={path =>
                setNavigation(previous => ({ ...previous, folderId: openFolder.id, path }))
              }
              manualContent={manualContent}
              scrollHost={folderGridContainerRef}
            />
          </div>
        </NativeScrollArea>
      ) : (
        manualContent
      )}
    </FolderPanel>
  )
}
