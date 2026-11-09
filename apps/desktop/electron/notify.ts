import { Notification } from 'electron'
import type { ActivityOccurrenceDTO, GameSourceDTO } from '@lc/shared'
import { upcomingOccurrences } from '@lc/core'

/**
 * 活动提醒调度。
 *
 * 不常驻轮询数据库表结构，而是每 30 秒取一次「未来 2 天的场次」，算好提醒时刻
 * 放在内存里比对当前时间 —— 单机数据量极小，30 秒一次的代价可以忽略，却能保证
 * 用户改了活动规则后最迟半分钟生效。
 *
 * 同一次场次的「提前提醒」和「开始提醒」各只弹一次，用 key 去重。
 */

const POLL_MS = 30_000
const MARGIN_MS = 90_000

interface ReminderItem {
  key: string
  occ: ActivityOccurrenceDTO
  remindAt: number
  kind: 'before' | 'start'
  beforeMinutes: number
}

export interface ReminderBanner {
  sourceId: number
  sourceName: string
  kind: 'before' | 'start'
  /** 距离活动开始还有几分钟；已经开始则为 0 */
  minutes: number
  /** 系统通知是否已弹出（Windows 通知被系统关掉时仍为 true，故主进程还要给应用内横幅） */
  osShown: boolean
}

export interface ReminderDeps {
  loadSources: () => Promise<GameSourceDTO[]>
  onOpen: (occ: ActivityOccurrenceDTO) => void
  /**
   * 每次提醒都会调用一次。系统通知点了不一定回到本进程（打包后点通知通常是
   * 通过快捷方式重新拉起应用），所以应用内横幅才是可靠的那条路径。
   */
  onRemind: (item: ReminderBanner) => void
}

let timer: NodeJS.Timeout | null = null
const fired = new Set<string>()

function buildReminders(sources: GameSourceDTO[]): ReminderItem[] {
  const now = new Date()
  const items: ReminderItem[] = []
  for (const occ of upcomingOccurrences(sources, now, 2)) {
    const src = sources.find((s) => s.id === occ.sourceId)
    if (!src || !src.reminder.enabled) continue
    const startAt = new Date(occ.start.replace(' ', 'T')).getTime()
    if (src.reminder.beforeMinutes > 0) {
      items.push({
        key: `${occ.sourceId}|${occ.start}|before`,
        occ,
        remindAt: startAt - src.reminder.beforeMinutes * 60_000,
        kind: 'before',
        beforeMinutes: src.reminder.beforeMinutes
      })
    }
    if (src.reminder.atStart) {
      items.push({
        key: `${occ.sourceId}|${occ.start}|start`,
        occ,
        remindAt: startAt,
        kind: 'start',
        beforeMinutes: 0
      })
    }
  }
  return items
}

async function tick(deps: ReminderDeps): Promise<void> {
  let sources: GameSourceDTO[]
  try {
    sources = await deps.loadSources()
  } catch {
    return
  }
  const now = Date.now()
  for (const item of buildReminders(sources)) {
    if (fired.has(item.key)) continue
    if (item.remindAt > now || item.remindAt < now - MARGIN_MS) continue
    fired.add(item.key)

    // 文案里的「几分钟后」是距活动开始的时间，不是距提醒触发的时间
    const startAt = new Date(item.occ.start.replace(' ', 'T')).getTime()
    const minutes = Math.max(0, Math.round((startAt - now) / 60_000))
    const title = item.kind === 'before' ? '活动快开始了' : '活动开始'
    const body =
      item.kind === 'before'
        ? minutes <= 0
          ? `${item.occ.sourceName} 即将开始（${item.occ.start.slice(11, 16)}）`
          : `${item.occ.sourceName} 将在 ${minutes} 分钟后开始（${item.occ.start.slice(11, 16)}）`
        : `${item.occ.sourceName} 现在开始（${item.occ.start.slice(11, 16)}~${item.occ.end.slice(11, 16)}）`

    const osShown = Notification.isSupported()
    if (osShown) {
      const n = new Notification({ title, body, silent: false })
      n.on('click', () => deps.onOpen(item.occ))
      n.show()
    }
    deps.onRemind({
      sourceId: item.occ.sourceId,
      sourceName: item.occ.sourceName,
      kind: item.kind,
      minutes,
      osShown
    })
  }

  // 清掉过期的去重 key，避免长时间运行后无限增长
  if (fired.size > 500) {
    const cutoff = now - 3 * 24 * 60 * 60_000
    for (const key of fired) {
      const [, start] = key.split('|')
      const t = new Date(start.replace(' ', 'T')).getTime()
      if (t < cutoff) fired.delete(key)
    }
  }
}

export function startReminders(deps: ReminderDeps): void {
  stopReminders()
  const run = (): void => {
    // 提醒是后台辅助功能：出异常只记日志，不能让主进程冒出未处理的 rejection
    tick(deps).catch((err) => console.error('[remind]', err))
  }
  run()
  timer = setInterval(run, POLL_MS)
}

export function stopReminders(): void {
  if (timer) clearInterval(timer)
  timer = null
}
