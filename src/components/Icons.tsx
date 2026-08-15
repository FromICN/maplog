type IconProps = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function MapIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9 4.5 3.8 6.6a1 1 0 0 0-.6.9v11.1c0 .7.7 1.2 1.4.9L9 17.5l6 2 5.2-2.1a1 1 0 0 0 .6-.9V5.4c0-.7-.7-1.2-1.4-.9L15 6.5Z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </svg>
  )
}

export function PassportIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M9.5 17h5" />
    </svg>
  )
}

/** Built from the same dot material as the map. */
export function BadgeIcon({ size = 22 }: IconProps) {
  const cells = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => [c, r] as const))
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {cells.map(([c, r]) => (
        <circle
          key={`${c}-${r}`}
          cx={6 + c * 6}
          cy={6 + r * 6}
          r={(c + r) % 2 === 0 ? 2.2 : 1.3}
        />
      ))}
    </svg>
  )
}

export function SettingsIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 7.5h16M4 16.5h16" />
      <circle cx="9.5" cy="7.5" r="2.4" />
      <circle cx="15" cy="16.5" r="2.4" />
    </svg>
  )
}

export function PlusIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CloseIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={1.8}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function HeartIcon({ size = 20, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20s-7.2-4.4-7.2-9.4A4.1 4.1 0 0 1 12 8.3a4.1 4.1 0 0 1 7.2 2.3c0 5-7.2 9.4-7.2 9.4Z" />
    </svg>
  )
}

export function PhotoIcon({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <circle cx="9" cy="10.5" r="1.8" />
      <path d="m4 16.5 4.2-4 3.3 3.1 3-2.7L20 17" />
    </svg>
  )
}

export function ChevronIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  )
}

export function SearchIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="6.2" />
      <path d="m15.6 15.6 4 4" />
    </svg>
  )
}

export function CheckIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2.2}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}
