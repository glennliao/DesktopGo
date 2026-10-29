import { createScrollGroup, normalizeScrollGroups } from '../icon-grid/scroll/scrollGroupLayout'
import type { FolderSize, PersistedLayout, ScrollGroupMeta } from '../icon-grid/model'
import { directoryDisplayName, resizeDirectoryFolder, type DirectoryLink } from './domain'

export function resizeDirectoryList(
  layout: PersistedLayout | null,
  id: string,
  path: string,
  size: FolderSize
): PersistedLayout | null {
  const group = layout?.scrollGroups?.find(group => group.id === id)
  if (!layout || !group?.directory) return layout
  const directory = resizeDirectoryFolder(group.directory, path, size)
  if (directory === group.directory) return layout
  return {
    ...layout,
    scrollGroups: layout.scrollGroups!.map(item =>
      item.id === id ? { ...item, directory } : item
    ),
  }
}

export const createDirectoryList = (directory: DirectoryLink, groups: ScrollGroupMeta[]) => ({
  ...createScrollGroup(directoryDisplayName(directory.rootPath), 'grid', groups),
  directory,
})

/** Add to the shared list records without replacing either legacy manual layout. */
export function prependDirectoryList(
  layout: PersistedLayout | null,
  directory: DirectoryLink,
  defaultName: (index: number) => string
): PersistedLayout {
  const source = layout ?? { items: [], slots: [], dockKeys: [] }
  const dockIds = new Set(
    source.dockKeys
      .filter((key): key is string => Boolean(key))
      .map(key => key.replace(/^(desktop|customapp):/, ''))
  )
  const outerItemIds = source.items
    .map(item =>
      item.type === 'folder' ? `folder:${item.id}` : item.key.replace(/^(desktop|customapp):/, '')
    )
    .filter(id => !dockIds.has(id))
  const groups =
    source.scrollGroups?.length || outerItemIds.length
      ? normalizeScrollGroups({
          groups: source.scrollGroups,
          outerItemIds,
          legacySlots: source.slots?.map(key => key?.replace(/^(desktop|customapp):/, '') ?? null),
          legacyPageSize: source.pageSize,
          hasExplicitItems: source.scrollGroupItemsExplicit === true,
          defaultName,
        })
      : []
  return {
    ...source,
    scrollGroups: [createDirectoryList(directory, groups), ...groups],
    scrollGroupItemsExplicit: true,
  }
}
