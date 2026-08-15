import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import './Toast.css'

const DURATION = 3200

export default function Toast() {
  const toast = useAppStore((s) => s.toast)
  const clearToast = useAppStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(clearToast, DURATION)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  if (!toast) return null

  return (
    <p className="toast" key={toast.key} role="status">
      {toast.text}
    </p>
  )
}
