import type {
  ActivityBannerPayload,
  AppInfo,
  BackupFile,
  BackupResult,
  LcBridge,
  NavigatePayload,
  UpdateCheckResult
} from './bridge'

export * from './bridge'

declare global {
  interface Window {
    /** preload 注入；只在 Electron 里存在 */
    lc: LcBridge
  }
}

export type {
  ActivityBannerPayload,
  AppInfo,
  BackupFile,
  BackupResult,
  LcBridge,
  NavigatePayload,
  UpdateCheckResult
}
