import { mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { UPLOAD_MAX_BYTES } from '@lc/shared'
import { ApiError } from '../middleware/error.js'
import { getPaths } from '../runtime.js'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

/**
 * 保存前端传来的 data URL 图片（物品图标 / 头像）。
 *
 * 用户图片一律落在 userData/images/<kind>/ 下，返回 `user/<kind>/<uuid>.<ext>` 这种
 * 相对路径存库。读取时由主进程的 app-img:// 协议解析：`user/` 前缀走用户目录，
 * 其余走安装包内置资源 —— 这样升级覆盖内置图标不会冲掉用户自己换过的图。
 */
export function saveDataUrlImage(kind: 'items' | 'avatars', dataUrl: string): string {
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl)
  if (!m) throw new ApiError(400, '图片格式不支持，请上传 PNG / JPG / WebP')
  const ext = MIME_EXT[m[1]]
  if (!ext) throw new ApiError(400, '图片格式不支持，请上传 PNG / JPG / WebP')

  const buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64')
  if (buf.byteLength === 0) throw new ApiError(400, '图片内容为空')
  if (buf.byteLength > UPLOAD_MAX_BYTES) {
    throw new ApiError(413, `图片不能超过 ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)}MB`)
  }

  const dir = join(getPaths().images, kind)
  mkdirSync(dir, { recursive: true })
  const name = `${randomUUID()}.${ext}`
  writeFileSync(join(dir, name), buf)
  return `user/${kind}/${name}`
}
