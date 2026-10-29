import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { DIRECTORY_REFRESH_EVENT } from './domain'
import type { DirectoryEntry, DirectoryLink } from './domain'

interface DirectoryResult {
  key: string
  entries: DirectoryEntry[]
  revision: number
  error: string | null
}

export function useDirectoryContents(
  link: DirectoryLink | undefined,
  relativePath: string,
  enabled = true
) {
  const rootPath = link?.rootPath
  const version = link?.version
  const key = JSON.stringify([rootPath, version, relativePath])
  const [result, setResult] = useState<DirectoryResult>({
    key,
    entries: [],
    revision: -1,
    error: null,
  })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    if (!enabled || rootPath === undefined || version !== 1) return
    void invoke<DirectoryEntry[]>('read_directory', { rootPath, relativePath })
      .then(entries => {
        if (!cancelled) setResult({ key, entries, revision, error: null })
      })
      .catch((error: { code?: string }) => {
        if (!cancelled)
          setResult(previous => ({
            key,
            entries: previous.key === key ? previous.entries : [],
            revision,
            error: error?.code ?? 'io_error',
          }))
      })
    return () => {
      cancelled = true
    }
  }, [key, rootPath, version, relativePath, revision, enabled])
  useEffect(() => {
    if (!enabled || rootPath === undefined) return
    const refresh = () => setRevision(value => value + 1)
    const requested = (event: Event) => {
      if ((event as CustomEvent).detail === rootPath) refresh()
    }
    const shown = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener(DIRECTORY_REFRESH_EVENT, requested)
    document.addEventListener('visibilitychange', shown)
    const unlisten = getCurrentWindow()
      .onFocusChanged(({ payload }) => {
        if (payload) refresh()
      })
      .catch(() => () => {})
    return () => {
      window.removeEventListener(DIRECTORY_REFRESH_EVENT, requested)
      document.removeEventListener('visibilitychange', shown)
      void unlisten.then(dispose => dispose())
    }
  }, [rootPath, enabled])
  const visible = result.key === key ? result : { key, entries: [], revision: -1, error: null }
  return {
    ...visible,
    loading: enabled && version === 1 && visible.revision !== revision,
    error: version === undefined || version === 1 ? visible.error : 'unsupported_version',
    refresh: () => setRevision(value => value + 1),
  }
}
