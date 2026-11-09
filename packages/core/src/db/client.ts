import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema.js'

export type Db = ReturnType<typeof drizzle<typeof schema>>
export interface DbHandle {
  client: Client
  db: Db
}

/** 把 Windows 路径规范成 file: URL 需要的正斜杠形式 */
function toFileUrl(path: string): string {
  return 'file:' + path.replace(/\\/g, '/')
}

/**
 * 打开（或创建）本地数据库。
 *
 * @libsql/client 走 N-API，Electron 里不需要按 ABI 重新编译 —— 这是选它而不是
 * better-sqlite3 的原因（后者要 electron-rebuild，在 Windows 上常因缺 VS 构建工具失败）。
 */
export async function openDb(file: string): Promise<DbHandle> {
  const client = createClient({ url: toFileUrl(file) })
  // WAL：写入不阻塞读取；busy_timeout 让并发写入自动等一会儿而不是直接报错
  await client.execute('PRAGMA journal_mode = WAL')
  await client.execute('PRAGMA busy_timeout = 5000')
  await client.execute('PRAGMA foreign_keys = ON')
  const db = drizzle(client, { schema })
  return { client, db }
}
