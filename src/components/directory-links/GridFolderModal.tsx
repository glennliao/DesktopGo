import type { MutableRefObject } from 'react'
import { FolderModalView, type FolderModalViewProps } from '../icon-grid/views/FolderModalView'
import { useIconStore } from '../../stores/iconStore'
import { useDirectoryActions } from './directoryActions'

type GridFolderModalProps = Omit<
  FolderModalViewProps,
  | 'bindFolderTileRef'
  | 'onBackdropClose'
  | 'onPanelPointerDown'
  | 'onPanelClick'
  | 'onRenameFolder'
  | 'onActivateIcon'
> & {
  folderTileRefs: MutableRefObject<Map<string, HTMLDivElement>>
  closeFolderImmediately: () => void
}

/** Shared folder interaction wiring for the paged and scrolling grids. */
export function GridFolderModal({
  folderTileRefs,
  closeFolderImmediately,
  ...props
}: GridFolderModalProps) {
  const { clearSelection, launchApp } = useIconStore()
  const directory = useDirectoryActions()
  return (
    <FolderModalView
      {...props}
      bindFolderTileRef={(id, node) => {
        if (node) folderTileRefs.current.set(id, node)
        else folderTileRefs.current.delete(id)
      }}
      onBackdropClose={event => {
        event.stopPropagation()
        if (event.target === event.currentTarget && props.dragContext !== 'folder') props.onClose()
      }}
      onPanelPointerDown={event => event.stopPropagation()}
      onPanelClick={event => {
        event.stopPropagation()
        if (props.selectionMode) clearSelection()
      }}
      onRenameFolder={(id, name) => directory?.renameFolder(id, name)}
      onActivateIcon={icon => {
        void launchApp(icon.icon.path).finally(closeFolderImmediately)
      }}
    />
  )
}
