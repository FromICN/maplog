import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The native build ships the same `dist` the web build produces, so the app
 * works with no network at all — the world grid, the country registry and every
 * city chunk are inside the APK rather than fetched.
 *
 * Build for this with `npm run build:app`, which leaves the base path at `/`
 * because the WebView serves the bundle from the root of its own origin.
 */
const config: CapacitorConfig = {
  appId: 'io.github.fromicn.maplog',
  appName: 'MapLog',
  webDir: 'dist',
  android: {
    // The app is dark end to end; a white flash on launch would be jarring.
    backgroundColor: '#0B0F14',
  },
}

export default config
