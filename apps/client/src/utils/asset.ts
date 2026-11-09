/**
 * 图片地址解析。
 *
 * 内置图标（items/xxx.png）与用户上传图（user/items/xxx.png）都由主进程的
 * 自定义协议 app-img 提供：渲染层没有网络，也不需要知道磁盘路径。
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^(https?:|data:|blob:|app-img:)/.test(path)) return path
  return `app-img://local/${path.replace(/^\/+/, '')}`
}
