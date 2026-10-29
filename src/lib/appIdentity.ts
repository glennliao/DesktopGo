import baseConfig from '../../src-tauri/tauri.conf.json' with { type: 'json' }

interface AppIdentity {
  name: string
  version: string
  identifier: string
}

// Every native window receives its merged build configuration before this bundle loads.
// The base configuration is also the identity of a plain browser preview.
export const appIdentity: AppIdentity = (
  globalThis as typeof globalThis & { __DESKTOPGO_APP_INFO__?: AppIdentity }
).__DESKTOPGO_APP_INFO__ ?? {
  name: baseConfig.productName,
  version: baseConfig.version,
  identifier: baseConfig.identifier,
}
