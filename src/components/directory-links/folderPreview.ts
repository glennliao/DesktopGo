import type { DesktopIcon } from '../../types'
import type { FolderItem, IconItem } from '../icon-grid/model'
import { getDesktopLargeFolderPreviewLayout } from '../icon-grid/views/folderPreviewPolicy'
import { directoryEntryId, sortDirectoryEntries, type DirectoryEntry } from './domain'

/** Build presentation data only; the persisted folder keeps its manual members. */
export function linkedFolderPreview(
  folder: FolderItem,
  entries: DirectoryEntry[],
  locale: string,
  iconFor: (entry: DirectoryEntry) => string
): FolderItem {
  if (!folder.directory) return folder
  const sorted = sortDirectoryEntries(entries, locale)
  const count = folder.children.length + sorted.length
  const limit =
    folder.size === '1x1'
      ? 4
      : getDesktopLargeFolderPreviewLayout(folder.size, count).visibleIconCount
  const children = folder.children.slice(0, limit)
  for (const entry of sorted.slice(0, Math.max(0, limit - children.length))) {
    const key = directoryEntryId(folder.directory.rootPath, entry)
    const icon: DesktopIcon = {
      id: key,
      name: entry.name,
      path: entry.path,
      target_path: entry.path,
      icon_base64: iconFor(entry),
      item_type: entry.isDirectory ? 'folder' : 'file',
      origin: 'import',
    }
    children.push({ kind: 'icon', key, icon } satisfies IconItem)
  }
  return { ...folder, children }
}
