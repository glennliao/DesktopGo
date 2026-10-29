import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { FolderPanel } from '../icon-grid/views/FolderPanel'
import {
  FOLDER_MODAL_MAX_HEIGHT,
  FOLDER_MODAL_MAX_WIDTH,
} from '../icon-grid/views/folderVisualPolicy'
import { NativeScrollArea } from '../ui/native-scroll-area'

export interface DirectoryDialogSelection {
  id: string
  name: string
  basePath: string
  initialPath: string
}

/** One existing folder panel handles the entire directory navigation session. */
export function DirectoryDialog({
  folder,
  sharedFolderId,
  onClose,
  onExitComplete,
  children,
}: {
  folder: DirectoryDialogSelection | null
  sharedFolderId: string | null
  onClose: () => void
  onExitComplete: () => void
  children: (scrollHost: RefObject<HTMLDivElement | null>) => ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!folder) return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [folder, onClose])
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <FolderPanel
        folder={folder}
        activeFolderSharedLayoutId={sharedFolderId}
        folderPanelRef={panel}
        width={FOLDER_MODAL_MAX_WIDTH}
        maxModalHeight={FOLDER_MODAL_MAX_HEIGHT}
        onClose={onClose}
        onExitComplete={onExitComplete}
        onBackdropClose={event => {
          event.stopPropagation()
          if (event.target === event.currentTarget) onClose()
        }}
        onPanelPointerDown={event => event.stopPropagation()}
        onPanelClick={event => event.stopPropagation()}
      >
        {folder ? (
          <NativeScrollArea asChild>
            <div
              ref={scroll}
              className="-mr-5 overflow-auto pr-5"
              style={{ maxHeight: `calc(min(80vh, ${FOLDER_MODAL_MAX_HEIGHT}px) - 48px)` }}
            >
              {children(scroll)}
            </div>
          </NativeScrollArea>
        ) : null}
      </FolderPanel>
    </div>,
    document.body
  )
}
