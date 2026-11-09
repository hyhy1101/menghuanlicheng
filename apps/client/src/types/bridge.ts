/**
 * 桌面主进程经 preload 注入到 window.lc 的桥。
 *
 * 单机版没有 HTTP 服务：`call` 把「方法 + 路径 + 请求体」直接交给主进程里的
 * Hono 路由（进程内调用），返回统一信封 { code, msg, data }。
 */

export interface ApiEnvelope<T = unknown> {
  code: number
  msg: string
  data: T
}

/** 主进程捕获异常后的返回形态 */
export interface BridgeFailure {
  ok: false
  code: number
  msg: string
  data?: unknown
}

export interface AppInfo {
  version: string
  isDev: boolean
  userData: string
  dbFile: string
  backupDir: string
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  url: string
  notes: string
  publishedAt: string
}

export interface BackupFile {
  name: string
  path: string
  size: number
  /** 形如 2026-11-09 08:30 */
  time: string
}

export interface BackupResult {
  ok: boolean
  msg?: string
  data?: string
}

export interface NavigatePayload {
  path: string
  sourceId?: number
  sourceName?: string
}

export interface ActivityBannerPayload {
  sourceId: number
  sourceName: string
  kind: string
  minutes: number
}

export interface LcBridge {
  call<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiEnvelope<T> | BridgeFailure>
  info(): Promise<AppInfo>
  checkUpdate(repo: string): Promise<{ ok: true; data: UpdateCheckResult } | { ok: false; msg: string }>
  openExternal(url: string): Promise<{ ok: boolean; msg?: string }>
  backup: {
    list(): Promise<BackupFile[]>
    export(): Promise<BackupResult>
    restore(file?: string): Promise<BackupResult>
  }
  saveText(filename: string, content: string): Promise<BackupResult>
  setAutoLaunch(enabled: boolean): Promise<{ ok: boolean }>
  getAutoLaunch(): Promise<boolean>
  onNavigate(cb: (payload: NavigatePayload) => void): () => void
  onActivityBanner(cb: (payload: ActivityBannerPayload) => void): () => void
}
