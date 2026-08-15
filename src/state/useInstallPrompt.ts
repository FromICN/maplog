import { useEffect, useState } from 'react'

type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = {
  /** Chrome and friends hand us an event we can trigger from a button. */
  canPrompt: boolean
  /** Safari has no such event; the reader has to use the share sheet. */
  needsManual: boolean
  installed: boolean
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function useInstallPrompt(): InstallState {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  return {
    canPrompt: !installed && event !== null,
    needsManual: !installed && event === null && isIos(),
    installed,
    install: async () => {
      if (!event) return 'unavailable'
      await event.prompt()
      const { outcome } = await event.userChoice
      if (outcome === 'accepted') setEvent(null)
      return outcome
    },
  }
}
