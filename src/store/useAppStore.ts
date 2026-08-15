import { create } from 'zustand'

export type TabId = 'map' | 'passport' | 'badges' | 'settings'

type AppState = {
  tab: TabId
  /** ISO 3166-1 alpha-2 of the country whose detail sheet is open. */
  selectedIso: string | null
  addVisitOpen: boolean
  /** Country whose city list is open, if any. */
  cityPickerIso: string | null
  setTab: (tab: TabId) => void
  selectCountry: (iso: string | null) => void
  openAddVisit: () => void
  closeAddVisit: () => void
  openCityPicker: (iso: string) => void
  closeCityPicker: () => void
  photoImportOpen: boolean
  openPhotoImport: () => void
  closePhotoImport: () => void
  /** Short confirmation shown at the bottom of the screen; replaced, not queued. */
  toast: { key: number; text: string } | null
  showToast: (text: string) => void
  clearToast: () => void
  /** Bulk record changes move badges without the reader earning anything. */
  badgeQuietUntil: number
  quietBadges: () => void
}

export const useAppStore = create<AppState>((set) => ({
  tab: 'map',
  selectedIso: null,
  addVisitOpen: false,
  cityPickerIso: null,
  setTab: (tab) => set({ tab, selectedIso: null }),
  selectCountry: (selectedIso) => set({ selectedIso }),
  openAddVisit: () => set({ addVisitOpen: true, selectedIso: null }),
  closeAddVisit: () => set({ addVisitOpen: false }),
  openCityPicker: (cityPickerIso) => set({ cityPickerIso, selectedIso: null }),
  closeCityPicker: () => set({ cityPickerIso: null }),
  photoImportOpen: false,
  openPhotoImport: () => set({ photoImportOpen: true, selectedIso: null }),
  closePhotoImport: () => set({ photoImportOpen: false }),
  toast: null,
  showToast: (text) => set({ toast: { key: Date.now(), text } }),
  clearToast: () => set({ toast: null }),
  badgeQuietUntil: 0,
  quietBadges: () => set({ badgeQuietUntil: Date.now() + 2000 }),
}))
