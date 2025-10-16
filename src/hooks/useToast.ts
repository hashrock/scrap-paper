import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToastState } from '../types'

interface UseToastResult {
  toast: ToastState
  showToast: (message: string) => void
}

const TOAST_DURATION = 3000

const useToast = (duration = TOAST_DURATION): UseToastResult => {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false })
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const showToast = useCallback((message: string) => {
    clearTimer()
    setToast({ message, visible: true })

    timerRef.current = window.setTimeout(() => {
      setToast({ message: '', visible: false })
      timerRef.current = null
    }, duration)
  }, [clearTimer, duration])

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return { toast, showToast }
}

export default useToast
