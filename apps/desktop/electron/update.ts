import { app, net } from 'electron'

/**
 * 手动检查更新（整个应用里唯一会发网络请求的地方）。
 *
 * 只在用户点「检查更新」时调用一次；不做后台轮询、不上报任何数据。
 * 仓库地址来自设置里的 owner/repo，为空则前端直接禁用按钮。
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

export async function checkUpdate(repo: string): Promise<UpdateInfo> {
  const currentVersion = app.getVersion()
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error('请先在设置里填写更新仓库（owner/repo）')
  }

  const res = await net.fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'mengHuanLiCheng' }
  })
  if (res.status === 404) throw new Error('没有找到 Release，仓库地址或发布状态可能不对')
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
