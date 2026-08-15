import { useEffect, useRef, useState } from 'react'
import { downloadBackup, parseBackup, readBackup, restoreBackup, clearAll } from '../db/backup'
import { useVisits } from '../state/useVisits'
import { useInstallPrompt } from '../state/useInstallPrompt'
import { useAppStore } from '../store/useAppStore'
import './SettingsScreen.css'

type Pending = 'restore' | 'clear' | null

export default function SettingsScreen() {
  const visits = useVisits()
  const install = useInstallPrompt()
  const showToast = useAppStore((s) => s.showToast)
  const quietBadges = useAppStore((s) => s.quietBadges)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [incoming, setIncoming] = useState<{ file: string; countries: number; cities: number } | null>(null)
  const pendingBackup = useRef<Awaited<ReturnType<typeof readBackup>> | null>(null)
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const check = () => setOfflineReady(Boolean(navigator.serviceWorker.controller))
    check()
    navigator.serviceWorker.addEventListener('controllerchange', check)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', check)
  }, [])

  const countries = visits.visited.size
  const cities = visits.cities.size

  async function onExport() {
    const backup = await readBackup()
    downloadBackup(backup)
    showToast('백업 파일을 저장했습니다')
  }

  async function onPickFile(file: File) {
    try {
      const backup = parseBackup(await file.text())
      pendingBackup.current = backup
      const countryCount = new Set(
        backup.visits.filter((v) => v.kind === 'country').map((v) => v.refId),
      ).size
      setIncoming({
        file: file.name,
        countries: countryCount,
        cities: backup.visits.filter((v) => v.kind === 'city').length,
      })
      setPending('restore')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '파일을 읽지 못했습니다')
    }
  }

  async function onRestore() {
    if (!pendingBackup.current) return
    quietBadges()
    await restoreBackup(pendingBackup.current)
    pendingBackup.current = null
    setPending(null)
    setIncoming(null)
    showToast('기록을 복원했습니다')
  }

  async function onClear() {
    quietBadges()
    await clearAll()
    setPending(null)
    showToast('기록을 모두 지웠습니다')
  }

  return (
    <div className="settings">
      <div className="settings__scroll">
        <section className="settings__section">
          <h2 className="settings__h2">기록</h2>
          <p className="settings__lede">
            모든 기록은 이 브라우저에만 저장됩니다. 기기를 바꾸거나 브라우저 데이터를 지우면
            사라지니, 가끔 파일로 내보내 두세요.
          </p>

          <p className="settings__summary">
            <span>
              <b>{countries}</b>개국
            </span>
            <span>
              도시 <b>{cities}</b>곳
            </span>
            <span>
              위시 <b>{visits.wishes.size}</b>곳
            </span>
          </p>

          <div className="settings__row">
            <button className="btn btn--primary" onClick={() => void onExport()}>
              파일로 내보내기
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              파일에서 불러오기
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void onPickFile(file)
            }}
          />

          {pending === 'restore' && incoming && (
            <div className="confirm">
              <p className="confirm__text">
                <b>{incoming.file}</b>의 기록 {incoming.countries}개국 · 도시 {incoming.cities}곳으로
                <strong> 지금 기록을 덮어씁니다.</strong>
              </p>
              <div className="settings__row">
                <button className="btn btn--primary" onClick={() => void onRestore()}>
                  덮어쓰기
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setPending(null)
                    setIncoming(null)
                    pendingBackup.current = null
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="settings__section">
          <h2 className="settings__h2">앱</h2>

          {install.installed ? (
            <p className="settings__lede">홈 화면 앱으로 실행 중입니다.</p>
          ) : install.canPrompt ? (
            <>
              <p className="settings__lede">홈 화면에 두면 앱처럼 바로 열립니다.</p>
              <div className="settings__row">
                <button className="btn btn--primary" onClick={() => void install.install()}>
                  홈 화면에 추가
                </button>
              </div>
            </>
          ) : install.needsManual ? (
            <p className="settings__lede">
              사파리 하단의 공유 버튼을 누르고 <b>홈 화면에 추가</b>를 선택하면 앱처럼 쓸 수
              있습니다.
            </p>
          ) : (
            <p className="settings__lede">
              브라우저 메뉴에서 <b>앱 설치</b>를 고르면 홈 화면에 추가됩니다.
            </p>
          )}

          <p className="settings__status" data-on={offlineReady || undefined}>
            {offlineReady ? '오프라인에서도 열립니다' : '오프라인 준비 중'}
          </p>
        </section>

        <section className="settings__section">
          <h2 className="settings__h2">기록 지우기</h2>
          {pending === 'clear' ? (
            <div className="confirm">
              <p className="confirm__text">
                방문한 {countries}개국과 도시 {cities}곳이 <strong>모두 사라집니다.</strong> 되돌릴
                수 없습니다.
              </p>
              <div className="settings__row">
                <button className="btn btn--danger" onClick={() => void onClear()}>
                  전부 지우기
                </button>
                <button className="btn" onClick={() => setPending(null)}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="settings__row">
              <button className="btn" onClick={() => setPending('clear')}>
                기록 전부 지우기
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
