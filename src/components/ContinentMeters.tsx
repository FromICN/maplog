import { CONTINENT_KO, type Country } from '../data/countries'
import { continentRows } from '../state/continentStats'
import DotMeter from './DotMeter'
import './ContinentMeters.css'

type Props = {
  countries: Country[]
  visited: Set<string>
  cityCount: Map<string, number>
}

export default function ContinentMeters({ countries, visited, cityCount }: Props) {
  const rows = continentRows(countries, visited, cityCount)

  return (
    <div className="meters">
      {rows.map(({ code, members, visited: been, levels }) => (
        <div className="meters__row" key={code}>
          <div className="meters__head">
            <span className="meters__name">{CONTINENT_KO[code]}</span>
            <span className="meters__count">
              <b>{been.length}</b>/{members.length}
            </span>
          </div>
          <DotMeter
            total={members.length}
            levels={levels}
            label={`${CONTINENT_KO[code]} ${members.length}개국 중 ${been.length}개국 방문`}
          />
        </div>
      ))}
    </div>
  )
}
