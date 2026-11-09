import type { DbHandle } from './db/client.js'

export interface RuntimePaths {
  /** userData 根目录（可写） */
  userData: string
  /** 用户上传的图片目录（userData/images） */
  images: string
  /** 内置资源目录（打包后为 renderer 目录，开发态为 apps/client/public） */
  assets: string
}

let paths: RuntimePaths | null = null
let handle: DbHandle | null = null

export function setPaths(p: RuntimePaths): void {
  paths = p
}

export function getPaths(): RuntimePaths {
  if (!paths) throw new Error('资源路径未初始化')
  return paths
}

export function setHandle(h: DbHandle): void {
  handle = h
}

export function getHandle(): DbHandle {
  if (!handle) throw new Error('数据库未初始化')
  return handle
}
