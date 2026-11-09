import { protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

/**
 * 自定义图片协议 app-img://local/<相对路径>
 *
 * - `user/...` 走 userData/images（用户上传的图标、头像，升级不会丢）
 * - 其余走内置资源目录（发布包里 610 张物品图）
 *
 * 必须注册成 standard + secure 才能在 <img> 与 fetch 里当普通 URL 用。
 */
export const IMAGE_SCHEME = 'app-img'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: IMAGE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true }
    }
  ])
}

export function handleImageProtocol(imagesDir: string, assetsDir: string): void {
  protocol.handle(IMAGE_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      if (!rel) return new Response('not found', { status: 404 })

      const isUser = rel.startsWith('user/')
      const base = isUser ? imagesDir : assetsDir
      const tail = isUser ? rel.slice('user/'.length) : rel
      const full = resolve(join(base, tail))

      // 防路径穿越：解析后的绝对路径必须仍落在 base 目录下
      const baseResolved = resolve(base)
      if (full !== baseResolved && !full.startsWith(baseResolved + sep)) {
        return new Response('forbidden', { status: 403 })
      }

      const buf = await readFile(full)
      const type = MIME[extname(full).toLowerCase()] ?? 'application/octet-stream'
      return new Response(new Uint8Array(buf), {
        headers: { 'Content-Type': type, 'Cache-Control': 'no-cache' }
      })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}
