import { CONTINENT_KO, type Country } from '../data/countries'
import { toggleCountryVisit, toggleWish } from '../db/db'
import { CheckIcon, ChevronIcon, CloseIcon, HeartIcon } from './Icons'
import FlagMark from './FlagMark'
import { useAppStore } from '../store/useAppStore'
import './CountrySheet.css'

type Props = {
  country: Country
  visited: boolean
  wished: boolean
  cities: number
  onClose: () => void
}

export default function CountrySheet({ country, visited, wished, cities, onClose }: Props) {
  const openCityPicker = useAppStore((s) => s.openCityPicker)
  const parentLabel = country.parent ? `${country.parent} 속령` : null

  return (
    <>
      <button className="sheet__scrim" aria-label="닫기" onClick={onClose} />
      <section className="sheet" role="dialog" aria-label={`${country.ko} 상세`}>
        <header className="sheet__head">
          <FlagMark flag={country.flag} iso2={country.iso2} size="lg" />
          <div className="sheet__title">
            <h2 className="sheet__name">{country.ko}</h2>
            <p className="sheet__meta">
              <span className="sheet__code">{country.iso3}</span>
              <span>{CONTINENT_KO[country.continent]}</span>
              {parentLabel && <span>{parentLabel}</span>}
              {!country.un && <span>UN 비회원</span>}
            </p>
          </div>
          <button className="sheet__close" aria-label="닫기" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="sheet__actions">
          <button
            className="action action--visit"
            aria-pressed={visited}
            onClick={() => void toggleCountryVisit(country.iso2)}
          >
            <CheckIcon size={18} />
            {visited ? '다녀왔어요' : '다녀왔어요로 표시'}
          </button>
          <button
            className="action action--wish"
            aria-pressed={wished}
            aria-label={wished ? '위시리스트에서 빼기' : '위시리스트에 담기'}
            onClick={() => void toggleWish('country', country.iso2)}
          >
            <HeartIcon size={18} filled={wished} />
          </button>
        </div>

        <button className="sheet__cities" onClick={() => openCityPicker(country.iso2)}>
          <span>도시 기록</span>
          <span className="sheet__citycount">{cities > 0 ? `${cities}곳` : '없음'}</span>
          <ChevronIcon size={18} />
        </button>
      </section>
    </>
  )
}
