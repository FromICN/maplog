import { lazy, Suspense } from 'react'
import TabBar from './components/TabBar'
import AddVisitSheet from './components/AddVisitSheet'
import CityPicker from './components/CityPicker'
// The EXIF reader is only needed once someone opens the importer, so it loads
// then. Workbox still precaches the chunk, so it works offline like everything else.
const PhotoImport = lazy(() => import('./components/PhotoImport'))
import MapScreen from './screens/MapScreen'
import PassportScreen from './screens/PassportScreen'
import BadgesScreen from './screens/BadgesScreen'
import SettingsScreen from './screens/SettingsScreen'
import Toast from './components/Toast'
import InstallBanner from './components/InstallBanner'
import { useWorld } from './map/useWorld'
import { useBadgeWatcher } from './state/useBadges'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const tab = useAppStore((s) => s.tab)
  const setTab = useAppStore((s) => s.setTab)
  const addVisitOpen = useAppStore((s) => s.addVisitOpen)
  const closeAddVisit = useAppStore((s) => s.closeAddVisit)
  const cityPickerIso = useAppStore((s) => s.cityPickerIso)
  const closeCityPicker = useAppStore((s) => s.closeCityPicker)
  const photoImportOpen = useAppStore((s) => s.photoImportOpen)
  const closePhotoImport = useAppStore((s) => s.closePhotoImport)
  const { world } = useWorld()
  const cityCountry = cityPickerIso ? world?.byIso.get(cityPickerIso) : undefined

  // Badges are watched app-wide so one earned while adding a visit still shows.
  useBadgeWatcher(world)

  return (
    <div className="app">
      <main className="app__view">
        {tab === 'map' && <MapScreen />}
        {tab === 'passport' && <PassportScreen />}
        {tab === 'badges' && <BadgesScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>
      <TabBar active={tab} onChange={setTab} />

      {/* Sits above the tab bar: picking places is a task you finish and leave. */}
      {addVisitOpen && world && <AddVisitSheet world={world} onClose={closeAddVisit} />}
      {cityCountry && <CityPicker country={cityCountry} onClose={closeCityPicker} />}
      {photoImportOpen && world && (
        <Suspense fallback={null}>
          <PhotoImport world={world} onClose={closePhotoImport} />
        </Suspense>
      )}
      {!addVisitOpen && !cityCountry && !photoImportOpen && <InstallBanner />}
      <Toast />
    </div>
  )
}
