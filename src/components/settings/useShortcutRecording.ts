import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { translate } from '@/lib/i18n'
import { useToast } from '@/components/ui/toast'

export function useShortcutRecording() {
  const [isRecordingShortcut, setRecording] = useState(false)
  const [recordingReady, setReady] = useState(false)
  const active = useRef(false)
  const pending = useRef<Promise<void>>(Promise.resolve())
  const toast = useToast()

  // Serialize focus/blur requests: a late pause must never outlive its restore.
  const syncRecording = useCallback((recording: boolean) => {
    const task = pending.current
      .catch(() => undefined)
      .then(() => invoke<void>('set_launchpad_shortcut_recording', { recording }))
    pending.current = task
    return task
  }, [])

  const reportError = useCallback(
    (error: unknown) => {
      console.error('Failed to change shortcut recording state:', error)
      toast.error(translate('快捷键录制失败：{error}', { error: String(error) }), {
        key: 'settings-shortcut',
        title: translate('启动台快捷键'),
      })
    },
    [toast]
  )

  const stopRecording = useCallback(() => {
    active.current = false
    setRecording(false)
    setReady(false)
    const task = syncRecording(false)
    void task.catch(reportError)
    return task
  }, [reportError, syncRecording])

  const startRecording = useCallback(() => {
    if (active.current) return
    active.current = true
    setRecording(true)
    setReady(false)
    const task = syncRecording(true)
    void task
      .then(() => {
        if (active.current && pending.current === task) setReady(true)
      })
      .catch(error => {
        if (pending.current === task) {
          active.current = false
          setRecording(false)
        }
        reportError(error)
      })
  }, [reportError, syncRecording])

  useEffect(() => {
    const onWindowBlur = () => {
      void stopRecording()
    }
    window.addEventListener('blur', onWindowBlur)
    return () => {
      active.current = false
      window.removeEventListener('blur', onWindowBlur)
      void syncRecording(false).catch(error =>
        console.error('Failed to restore shortcut after leaving settings:', error)
      )
    }
  }, [stopRecording, syncRecording])

  return { isRecordingShortcut, recordingReady, startRecording, stopRecording }
}
