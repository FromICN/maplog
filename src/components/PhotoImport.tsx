import { useEffect, useRef, useState } from 'react'
import type { World } from '../data/countries'
import { scanPhotos, type PhotoScan } from '../data/photos'
import { addVisits } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { CheckIcon, CloseIcon, PhotoIcon } from './Icons'
import './PhotoImport.css'

type Props = { world: World; onClose: () => void }

type Stage =
  | { name: 'idle' }
  | { name: 'reading'; done: number; total: number }
  | { name: 'review'; scan: PhotoScan; chosen: Set<string> }

export default function PhotoImport({ world, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>({ name: 'idle' })
  const showToast = useAppStore((s) => s.showToast)
  const quietBadges = useAppStore((s) => s.quietBadges)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function onFiles(files: File[]) {
    setStage({ name: 'reading', done: 0, total: files.length })
    const scan = await scanPhotos(world, files, (done, total) =>
      setStage({ name: 'reading', done, total }),
    )
    setStage({ name: 'review', scan, chosen: new Set(scan.places.map((p) => p.key)) })
  }

  async function onApply() {
    if (stage.name !== 'review') return
    const picked = stage.scan.places.filter((p) => stage.chosen.has(p.key))
    // Several places arriving at once is an import, not a run of achievements.
    quietBadges()
    const added = await addVisits(
      picked.map((p) => ({
        countryIso: p.countryIso,
        cityId: p.city?.id,
        startDate: p.date,
      })),
    )
    showToast(added > 0 ? `${added}곳을 기록했습니다` : '이미 기록된 곳들입니다')
    onClose()
  }

  return (
    <div className="photos" role="dialog" aria-modal="true" aria-label="사진에서 가져오기">
      <header className="photos__head">
        <div>
          <h2 className="photos__title">사진에서 가져오기</h2>
          <p className="photos__sub">사진에 남은 위치로 방문한 곳을 찾습니다.</p>
        </div>
        <button className="photos__close" aria-label="닫기" onClick={onClose}>
          <CloseIcon size={22} />
        </button>
      </header>

      <div className="photos__body">
        {stage.name === 'idle' && (
          <div className="photos__empty">
            <PhotoIcon size={40} />
            <p className="photos__lede">
              여행 사진을 고르면 촬영 위치를 읽어 나라와 도시를 찾아 드립니다. 기록하기 전에
              어디가 잡혔는지 먼저 보여 드립니다.
            </p>
            <p className="photos__privacy">
              사진은 이 기기 안에서만 읽습니다. 어디로도 올라가지 않고, 좌표만 쓰고 파일은
              저장하지 않습니다.
            </p>
            <button className="photos__pick" onClick={() => fileRef.current?.click()}>
              사진 고르기
            </button>
          </div>
        )}

        {stage.name === 'reading' && (
          <div className="photos__empty">
            <p className="photos__count">
              <b>{stage.done}</b>/{stage.total}
            </p>
            <p className="photos__lede">사진에서 위치를 읽는 중입니다.</p>
          </div>
        )}

        {stage.name === 'review' && (
          <>
            {stage.scan.places.length === 0 ? (
              <div className="photos__empty">
                <p className="photos__lede">위치가 남아 있는 사진을 찾지 못했습니다.</p>
                <p className="photos__privacy">
                  스크린샷이나 메신저로 받은 사진에는 위치가 지워져 있는 경우가 많습니다.
                </p>
                <button className="photos__pick" onClick={() => fileRef.current?.click()}>
                  다시 고르기
                </button>
              </div>
            ) : (
              <ul className="photos__list">
                {stage.scan.places.map((place) => {
                  const on = stage.chosen.has(place.key)
                  return (
                    <li className="found" key={place.key}>
                      <button
                        className="found__row"
                        aria-pressed={on}
                        onClick={() =>
                          setStage((s) => {
                            if (s.name !== 'review') return s
                            const chosen = new Set(s.chosen)
                            if (on) chosen.delete(place.key)
                            else chosen.add(place.key)
                            return { ...s, chosen }
                          })
                        }
                      >
                        <span className="found__mark">
                          <CheckIcon size={16} />
                        </span>
                        <span className="found__text">
                          <span className="found__label">{place.label}</span>
                          <span className="found__meta">
                            <span>사진 {place.photos}장</span>
                            {place.date && <span className="found__date">{place.date}</span>}
                            {place.distanceKm !== null && place.distanceKm > 5 && (
                              <span className="found__date">{place.distanceKm}km</span>
                            )}
                            {!place.city && <span>가까운 도시 없음</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {(stage.scan.noLocation > 0 || stage.scan.unmatched > 0) && (
              <p className="photos__skipped">
                {stage.scan.noLocation > 0 && `위치 없는 사진 ${stage.scan.noLocation}장`}
                {stage.scan.noLocation > 0 && stage.scan.unmatched > 0 && ' · '}
                {stage.scan.unmatched > 0 && `나라를 찾지 못한 사진 ${stage.scan.unmatched}장`}
                은 건너뛰었습니다.
              </p>
            )}
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) void onFiles(files)
        }}
      />

      {stage.name === 'review' && stage.scan.places.length > 0 && (
        <div className="photos__footer">
          <button className="photos__more" onClick={() => fileRef.current?.click()}>
            다시 고르기
          </button>
          <button
            className="photos__apply"
            disabled={stage.chosen.size === 0}
            onClick={() => void onApply()}
          >
            {stage.chosen.size}곳 기록하기
          </button>
        </div>
      )}
    </div>
  )
}
