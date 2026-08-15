import { useState } from 'react'
import { useInstallPrompt } from '../state/useInstallPrompt'
import { CloseIcon } from './Icons'
import './InstallBanner.css'

const DISMISSED = 'maplog.install-dismissed'

/**
 * Offered once. Turning it down is remembered, and the same action stays
 * available in settings for anyone who changes their mind.
 */
export default function InstallBanner() {
  const install = useInstallPrompt()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED) === '1')

  if (dismissed || !install.canPrompt) return null

  const dismiss = () => {
    localStorage.setItem(DISMISSED, '1')
    setDismissed(true)
  }

  return (
    <div className="installbar" role="region" aria-label="홈 화면에 추가">
      <p className="installbar__text">홈 화면에 두면 앱처럼 바로 열립니다.</p>
      <button
        className="installbar__go"
        onClick={() => {
          void install.install().then((outcome) => {
            if (outcome !== 'dismissed') dismiss()
          })
        }}
      >
        추가
      </button>
      <button className="installbar__close" aria-label="나중에" onClick={dismiss}>
        <CloseIcon size={18} />
      </button>
    </div>
  )
}
