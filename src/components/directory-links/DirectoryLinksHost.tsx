import { createDirectoryList } from './listLayoutPolicy'
import { FolderPlus, PanelsTopLeft } from 'lucide-react'
import { LayoutGroup } from 'framer-motion'
import { finalizeFolderExtractionInTopLevelLayout } from '../icon-grid/domain/folderPolicy'
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { ContextMenuItem, ContextMenuSeparator } from '../ui/context-menu'
import { useToast } from '../ui/toast'
import { translate } from '../../lib/i18n'
import { getId, makeFolderId, type GridItem, type ScrollGroupMeta } from '../icon-grid/model'
import { directoryDisplayName, resizeDirectoryFolder, type DirectoryLink } from './domain'

import { DirectoryContext, useDirectoryActions } from './directoryActions'
import {
  DIRECTORY_CREATE_EVENT as CREATE_EVENT,
  DIRECTORY_CREATE_LIST_EVENT as CREATE_LIST_EVENT,
  DIRECTORY_REFRESH_EVENT as REFRESH_EVENT,
} from './domain'

interface HostState {
  itemsRef: MutableRefObject<GridItem[]>
  setItems: Dispatch<SetStateAction<GridItem[]>>
  outerSlotsRef: MutableRefObject<Array<string | null>>
  setOuterSlots: Dispatch<SetStateAction<Array<string | null>>>
  dockKeysRef: MutableRefObject<Array<string | null>>
  setDockKeys: Dispatch<SetStateAction<Array<string | null>>>
  groupsRef?: MutableRefObject<ScrollGroupMeta[]>
  setGroups?: Dispatch<SetStateAction<ScrollGroupMeta[]>>
  currentGroupId?: string
  onSelectGroup?: (page: number) => void
}

export function DirectoryLinksHost({ children, ...state }: HostState & { children: ReactNode }) {
  const latest = useRef(state)
  const toast = useToast()
  const [folderOpenPath, setFolderOpenPath] = useState<{
    folderId: string
    path: string
    sequence: number
  } | null>(null)
  useEffect(() => {
    latest.current = state
  })

  const pick = async (): Promise<DirectoryLink | undefined> => {
    const path = await open({ directory: true, multiple: false, title: translate('关联目录') })
    return typeof path === 'string' ? { version: 1, rootPath: path } : undefined
  }
  const reportFailure = (error: unknown) => {
    console.error('Directory link failed:', error)
    toast.error(translate('无法关联目录，请重试。'), { key: 'directory-link' })
  }
  const publishItems = (items: GridItem[]) => {
    latest.current.itemsRef.current = items
    latest.current.setItems(items)
  }
  const change = async (kind: 'folder' | 'group', id: string, unlink = false) => {
    const directory = unlink ? undefined : await pick()
    if (!unlink && !directory) return
    const current = latest.current
    if (kind === 'folder') {
      const items = current.itemsRef.current.map(item =>
        item.kind === 'folder' && item.id === id ? { ...item, directory } : item
      )
      if (!unlink) {
        publishItems(items)
        return
      }
      const folder = items.find(item => item.kind === 'folder' && item.id === id)
      const result = finalizeFolderExtractionInTopLevelLayout(
        items,
        current.outerSlotsRef.current,
        current.dockKeysRef.current,
        id
      )
      publishItems(result.items)
      current.outerSlotsRef.current = result.outerSlots
      current.dockKeysRef.current = result.dockKeys
      current.setOuterSlots(result.outerSlots)
      current.setDockKeys(result.dockKeys)
      if (
        current.groupsRef &&
        current.setGroups &&
        folder?.kind === 'folder' &&
        folder.children.length < 2
      ) {
        const replacement = folder.children[0]?.key
        const groups = current.groupsRef.current.map(group => ({
          ...group,
          itemIds: group.itemIds.flatMap(key =>
            key === `folder:${id}` ? (replacement ? [replacement] : []) : [key]
          ),
        }))
        current.groupsRef.current = groups
        current.setGroups(groups)
      }
    } else if (current.groupsRef && current.setGroups) {
      const groups = current.groupsRef.current.map(group =>
        group.id === id ? { ...group, directory } : group
      )
      current.groupsRef.current = groups
      current.setGroups(groups)
    }
  }
  const createList = async (directory: DirectoryLink) => {
    const current = latest.current
    if (current.groupsRef && current.setGroups) {
      const groups = [
        createDirectoryList(directory, current.groupsRef.current),
        ...current.groupsRef.current,
      ]
      current.groupsRef.current = groups
      current.setGroups(groups)
      current.onSelectGroup?.(0)
    }
  }
  useEffect(() => {
    const create = (event: Event) => {
      if (event.type === CREATE_LIST_EVENT && !latest.current.groupsRef) return
      void pick()
        .then(async directory => {
          if (!directory) return
          if (event.type === CREATE_LIST_EVENT) {
            await createList(directory)
            return
          }
          const current = latest.current
          const folder: GridItem = {
            kind: 'folder',
            id: makeFolderId(),
            name: directoryDisplayName(directory.rootPath),
            size: '2x2',
            children: [],
            directory,
          }
          publishItems([...current.itemsRef.current, folder])
          if (current.groupsRef && current.setGroups) {
            const target = current.currentGroupId ?? current.groupsRef.current[0]?.id
            const groups = current.groupsRef.current.map(group =>
              group.id === target ? { ...group, itemIds: [...group.itemIds, getId(folder)] } : group
            )
            current.groupsRef.current = groups
            current.setGroups(groups)
          }
        })
        .catch(reportFailure)
    }
    window.addEventListener(CREATE_EVENT, create)
    window.addEventListener(CREATE_LIST_EVENT, create)
    return () => {
      window.removeEventListener(CREATE_EVENT, create)
      window.removeEventListener(CREATE_LIST_EVENT, create)
    }
  })
  return (
    <DirectoryContext.Provider
      value={{
        resizeDirectoryFolder: (kind, id, path, size) => {
          const current = latest.current
          if (kind === 'folder')
            publishItems(
              current.itemsRef.current.map(item =>
                item.kind === 'folder' && item.id === id && item.directory
                  ? { ...item, directory: resizeDirectoryFolder(item.directory, path, size) }
                  : item
              )
            )
          else if (current.groupsRef && current.setGroups) {
            const groups = current.groupsRef.current.map(group =>
              group.id === id && group.directory
                ? { ...group, directory: resizeDirectoryFolder(group.directory, path, size) }
                : group
            )
            current.groupsRef.current = groups
            current.setGroups(groups)
          }
        },
        folderOpenPath,
        prepareFolderOpen: (folderId, path) =>
          setFolderOpenPath(previous => ({
            folderId,
            path,
            sequence: (previous?.sequence ?? 0) + 1,
          })),
        change: (kind, id, unlink) => {
          void change(kind, id, unlink).catch(reportFailure)
        },
        renameFolder: (id, name) =>
          publishItems(
            latest.current.itemsRef.current.map(item =>
              item.kind === 'folder' && item.id === id ? { ...item, name } : item
            )
          ),
      }}
    >
      <LayoutGroup id="folder-shell-layout">{children}</LayoutGroup>
    </DirectoryContext.Provider>
  )
}

export function CreateDirectoryMenuItem({
  kind,
  disabled = false,
}: {
  kind: 'folder' | 'list'
  disabled?: boolean
}) {
  const Icon = kind === 'list' ? PanelsTopLeft : FolderPlus
  return (
    <ContextMenuItem
      className="gap-2"
      disabled={disabled}
      onSelect={() =>
        window.dispatchEvent(new Event(kind === 'list' ? CREATE_LIST_EVENT : CREATE_EVENT))
      }
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      {translate(kind === 'list' ? '添加关联列表' : '添加关联文件夹')}
    </ContextMenuItem>
  )
}

export function DirectoryLinkMenuItems({
  kind,
  id,
  directory,
}: {
  kind: 'folder' | 'group'
  id: string
  directory?: DirectoryLink
}) {
  const actions = useDirectoryActions()
  if (!actions) return null
  const itemClassName =
    kind === 'folder'
      ? 'px-3 py-2 text-foreground/85 focus:bg-accent focus:text-foreground'
      : undefined
  return (
    <>
      <ContextMenuItem className={itemClassName} onSelect={() => actions.change(kind, id)}>
        {translate(directory ? '更换关联目录' : '关联目录')}
      </ContextMenuItem>
      {directory ? (
        <>
          <ContextMenuItem
            className={itemClassName}
            onSelect={() =>
              window.dispatchEvent(new CustomEvent(REFRESH_EVENT, { detail: directory.rootPath }))
            }
          >
            {translate('刷新')}
          </ContextMenuItem>
          <ContextMenuItem
            className={itemClassName}
            onSelect={() => actions.change(kind, id, true)}
          >
            {translate('取消关联')}
          </ContextMenuItem>
        </>
      ) : null}
      <ContextMenuSeparator className={kind === 'folder' ? 'mx-1 my-1 bg-border/70' : undefined} />
    </>
  )
}
