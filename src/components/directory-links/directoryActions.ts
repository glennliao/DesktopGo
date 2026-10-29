import { createContext, useContext } from 'react'
import type { FolderSize } from '../icon-grid/model'

export interface DirectoryActions {
  change: (kind: 'folder' | 'group', id: string, unlink?: boolean) => void
  renameFolder: (id: string, name: string) => void
  folderOpenPath: { folderId: string; path: string; sequence: number } | null
  prepareFolderOpen: (folderId: string, path: string) => void
  resizeDirectoryFolder: (
    kind: 'folder' | 'group',
    id: string,
    path: string,
    size: FolderSize
  ) => void
}

export const DirectoryContext = createContext<DirectoryActions | null>(null)
export const useDirectoryActions = () => useContext(DirectoryContext)
