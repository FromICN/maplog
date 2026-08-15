import type { ReactElement } from 'react'
import { BadgeIcon, MapIcon, PassportIcon, SettingsIcon } from './Icons'
import type { TabId } from '../store/useAppStore'
import './TabBar.css'

const TABS: { id: TabId; label: string; Icon: (p: { size?: number }) => ReactElement }[] = [
  { id: 'map', label: '지도', Icon: MapIcon },
  { id: 'passport', label: '여권', Icon: PassportIcon },
  { id: 'badges', label: '배지', Icon: BadgeIcon },
  { id: 'settings', label: '설정', Icon: SettingsIcon },
]

type Props = { active: TabId; onChange: (id: TabId) => void }

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="주요 화면">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="tabbar__item"
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon size={22} />
          <span className="tabbar__label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
