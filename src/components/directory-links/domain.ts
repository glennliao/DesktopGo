import type { FolderSize } from '../icon-grid/model'

export interface DirectoryLink {
  version: number
  rootPath: string
  folderSizes?: Record<string, FolderSize>
}

const isFolderSize = (value: unknown): value is FolderSize =>
  ['1x1', '1x2', '2x1', '2x2'].includes(value as string)
export const normalizeDirectoryPath = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).join('/')
const directorySizeKey = normalizeDirectoryPath
export const directoryFolderSize = (link: DirectoryLink, path: string): FolderSize => {
  const size = link.folderSizes?.[directorySizeKey(path)]
  return isFolderSize(size) ? size : '2x2'
}
export function resizeDirectoryFolder(
  link: DirectoryLink,
  path: string,
  size: FolderSize
): DirectoryLink {
  if (directoryFolderSize(link, path) === size) return link
  return { ...link, folderSizes: { ...link.folderSizes, [directorySizeKey(path)]: size } }
}

export const DIRECTORY_CREATE_EVENT = 'launchpad:create-directory-folder'
export const DIRECTORY_CREATE_LIST_EVENT = 'launchpad:create-directory-list'
export const DIRECTORY_REFRESH_EVENT = 'launchpad:refresh-directory'
export const DIRECTORY_LISTS_CHANGED_EVENT = 'launchpad:directory-lists-changed'

export interface DirectoryEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  canEnter: boolean
}

/** Retain future formats for round trips, but only read the supported version. */
export const parseDirectoryLink = (value: unknown): DirectoryLink | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const link = value as Record<string, unknown>
  const sizes =
    link.version === 1 && link.folderSizes && typeof link.folderSizes === 'object'
      ? Object.fromEntries(
          Object.entries(link.folderSizes)
            .filter(([, size]) => isFolderSize(size))
            .map(([path, size]) => [directorySizeKey(path), size])
        )
      : undefined
  return typeof link.version === 'number' &&
    typeof link.rootPath === 'string' &&
    link.rootPath.trim()
    ? {
        ...link,
        version: link.version,
        rootPath: link.rootPath,
        ...(link.version === 1 && 'folderSizes' in link ? { folderSizes: sizes } : {}),
      }
    : undefined
}

export const directoryAncestors = (relativePath: string, basePath = ''): string[] => {
  const parts = relativePath.split(/[\\/]/).filter(Boolean)
  const ancestors = ['', ...parts.map((_, index) => parts.slice(0, index + 1).join('/'))]
  const base = normalizeDirectoryPath(basePath)
  return base ? ancestors.filter(path => path === base || path.startsWith(base + '/')) : ancestors
}

export const directoryDisplayName = (path: string) =>
  path
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .pop() || path

export const sortDirectoryEntries = (entries: DirectoryEntry[], locale: string) => {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  return [...entries].sort(
    (a, b) => Number(b.isDirectory) - Number(a.isDirectory) || collator.compare(a.name, b.name)
  )
}

export const directoryEntryId = (rootPath: string, entry: DirectoryEntry) =>
  JSON.stringify([rootPath, entry.relativePath])
