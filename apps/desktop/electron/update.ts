import { app, net } from 'electron'
import { UPDATE_REPO } from '@lc/shared'

/**
 * 手动检查更新（整个应用里唯一会发网络请求的地方）。
 *
 * 只在用户点「检查更新」时调用一次；不做后台轮询、不上报任何数据。
 * 仓库地址写死在 @lc/shared 的 UPDATE_REPO 里，界面不再提供配置项。
 */
export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  url: string
  notes: string
  publishedAt: string
}

interface ReleaseResponse {
  tag_name?: string
  name?: string
  body?: string
  html_url?: string
  published_at?: string
}

function normalize(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split(/[.\-+]/)
    .map((x) => Number.parseInt(x, 10) || 0)
}

export function compareVersion(a: string, b: string): number {
  const x = normalize(a)
  const y = normalize(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

export async function checkUpdate(repo: string = UPDATE_REPO): Promise<UpdateInfo> {
  const currentVersion = app.getVersion()
  const target = (repo || UPDATE_REPO).trim()
  if (!/^[\w.-]+\/[\w.-]+$/.test(target)) {
    throw new Error('更新仓库地址配置有误（应为 owner/repo）')
  }

  let res: Response
  try {
    // 必须设超时：网络不通时 net.fetch 会挂很久，界面一直转圈
    res = await net.fetch(`https://api.github.com/repos/${target}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'mengHuanLiCheng' },
      signal: AbortSignal.timeout(8000)
    })
  } catch {
    throw new Error('连不上 GitHub，检查更新失败。请检查网络后重试')
  }
  if (res.status === 404) throw new Error('还没有发布 Release，或仓库地址不对')
  if (!res.ok) throw new Error(`检查更新失败（HTTP ${res.status}）`)

  const json = (await res.json()) as ReleaseResponse
  const latestVersion = (json.tag_name ?? json.name ?? '').replace(/^v/i, '')
  if (!latestVersion) throw new Error('Release 里没有版本号')

  return {
    currentVersion,
    latestVersion,
    hasUpdate: compareVersion(latestVersion, currentVersion) > 0,
    url: json.html_url ?? '',
    notes: json.body ?? '',
    publishedAt: json.published_at ?? ''
  }
}
