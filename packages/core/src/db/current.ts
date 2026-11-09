import type { Db } from './client.js'

/**
 * 当前数据库实例。
 *
 * 单机应用一个进程只有一个库，用模块级可变绑定比把 db 参数穿过几十个函数更省事；
 * ES 模块的 live binding 保证 initDb() 之后所有导入方看到的都是新值。
 */
export let db: Db = null as unknown as Db

export function initDb(handle: Db): void {
  db = handle
}
