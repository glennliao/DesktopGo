import { useCallback, useEffect, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { translate } from '../../lib/i18n'
import { useIconStore } from '../../stores/iconStore'
import { useToast } from '../ui/toast'
import { readLayoutStrict, writePersistedLayout } from '../icon-grid/services/layoutStore'
import type { FolderSize, PersistedLayout } from '../icon-grid/model'
import { DIRECTORY_CREATE_LIST_EVENT, DIRECTORY_LISTS_CHANGED_EVENT } from './domain'
import { prependDirectoryList, resizeDirectoryList } from './listLayoutPolicy'

/** Both presentations use the same linked group records in the existing scroll layout. */
export function useDirectoryLists(resetToken: number) {
  const [layout, setLayout] = useState<PersistedLayout | null>(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const toast = useToast()
  const select = useIconStore(state => state.setActiveDirectoryListId)
  const writes = useRef<Promise<unknown>>(Promise.resolve())
  const updateLayout = useCallback(
    (change: (source: PersistedLayout | null) => PersistedLayout | null) => {
      const job = writes.current.then(async () => {
        const source = await readLayoutStrict('scroll')
        const next = change(source)
        if (next !== source) {
          await writePersistedLayout(next, 'scroll')
          setLayout(next)
        }
        return next
      })
      // Each caller reports its error; keep subsequent edits runnable after a failed write.
      writes.current = job.catch(() => undefined)
      return job
    },
    []
  )
  useEffect(() => {
    let cancelled = false
    let request = 0
    const read = async () => {
      const current = ++request
      try {
        const next = await readLayoutStrict('scroll')
        if (!cancelled && current === request) {
          setLayout(next)
          setError(false)
          const activeId = useIconStore.getState().activeDirectoryListId
          if (
            activeId &&
            !next?.scrollGroups?.some(group => group.id === activeId && group.directory)
          )
            select(null)
        }
      } catch (error) {
        console.error('Failed to read linked lists:', error)
        if (!cancelled && current === request) setError(true)
      }
    }
    void read()
    window.addEventListener(DIRECTORY_LISTS_CHANGED_EVENT, read)
    return () => {
      cancelled = true
      window.removeEventListener(DIRECTORY_LISTS_CHANGED_EVENT, read)
    }
  }, [resetToken, revision, select])
  useEffect(() => {
    let active = true
    let picking = false
    const create = async () => {
      if (picking) return
      picking = true
      try {
        const path = await open({ directory: true, multiple: false, title: translate('关联目录') })
        if (typeof path !== 'string' || !active) return
        const next = await updateLayout(source =>
          prependDirectoryList(source, { version: 1, rootPath: path }, index =>
            translate('网格 {index}', { index: index + 1 })
          )
        )
        if (active && next) {
          select(next.scrollGroups![0].id)
        }
      } catch (error) {
        console.error('Directory list creation failed:', error)
        if (active) toast.error(translate('无法关联目录，请重试。'), { key: 'directory-link' })
      } finally {
        picking = false
      }
    }
    window.addEventListener(DIRECTORY_CREATE_LIST_EVENT, create)
    return () => {
      active = false
      window.removeEventListener(DIRECTORY_CREATE_LIST_EVENT, create)
    }
  }, [select, toast, updateLayout])
  useEffect(() => () => select(null), [select])
  const resizeFolder = (id: string, path: string, size: FolderSize) => {
    void updateLayout(source => resizeDirectoryList(source, id, path, size)).catch(error => {
      console.error('Failed to save directory size:', error)
      toast.error(translate('保存目录设置失败'), { key: 'directory-size' })
    })
  }
  return { layout, error, resizeFolder, retry: () => setRevision(value => value + 1) }
}
