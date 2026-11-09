/**
 * 主进程领域层入口：桌面端只需要 openLocalDb + callApi。
 */
import { app } from './app.js'
import { openDb, type DbHandle } from './db/client.js'
import { initDb } from './db/current.js'
import { migrate } from './db/migrate.js'
import { seedIfEmpty } from './db/seed.js'
import { setHandle, setPaths, type RuntimePaths } from './runtime.js'

export { app } from './app.js'
export { openDb } from './db/client.js'
export { migrate } from './db/migrate.js'
export { seedIfEmpty } from './db/seed.js'
export { refreshAllDailyStats } from './lib/stats.js'
export { upcomingOccurrences, describeRule, occurrencesOf } from './lib/activity.js'
export { setPaths, getPaths } from './runtime.js'
export type { RuntimePaths } from './runtime.js'
export type { DbHandle } from './db/client.js'

/**
 * 打开本地库并完成迁移 + 首次种子。主进程启动时调用一次。
 */
export async function initLocalDb(paths: RuntimePaths, dbFile: string): Promise<DbHandle> {
  setPaths(paths)
  const handle = await openDb(dbFile)
  initDb(handle.db)
  setHandle(handle)
  await migrate(handle.client)
  await seedIfEmpty()
  return handle
}

export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

/**
 * 进程内调用：渲染层发来的 { method, path, body } 直接交给 Hono 路由。
 * 不监听端口、不走 http —— 断网环境下也一样能用。
 */
export async function callApi<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await app.request(path, init)
  const json = (await res.json()) as ApiResponse<T>
  if (!res.ok || (json.code !== undefined && json.code !== 200)) {
    const err = new Error(json?.msg || '操作失败') as Error & { code?: number; data?: unknown }
    err.code = json?.code ?? res.status
    err.data = json?.data
    throw err
  }
  return json
}
