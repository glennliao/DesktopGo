import { useMemo } from 'react'
import type { FolderItem } from '../icon-grid/model'
import { getIntlLocale, useI18n } from '../../lib/i18n'
import { useDirectoryContents } from './useDirectoryContents'
import { useVisibleSearchIcons } from '../search/useVisibleSearchIcons'
import { linkedFolderPreview } from './folderPreview'

export function useLinkedFolderPreview(folder: FolderItem, visible: boolean, relativePath = '') {
  useI18n()
  const { entries } = useDirectoryContents(folder.directory, relativePath, visible)
  const locale = getIntlLocale()
  const preview = useMemo(
    () => linkedFolderPreview(folder, entries, locale, () => ''),
    [folder, entries, locale]
  )
  const requests = useMemo(
    () =>
      preview.children
        .slice(folder.children.length)
        .map(child => ({ path: child.icon.path, isFolder: child.icon.item_type === 'folder' })),
    [preview, folder.children.length]
  )
  const iconFor = useVisibleSearchIcons(requests, visible && Boolean(folder.directory))
  const display = useMemo(
    () =>
      linkedFolderPreview(folder, entries, locale, entry => iconFor(entry.path, entry.isDirectory)),
    [folder, entries, locale, iconFor]
  )
  return { display, entries }
}
