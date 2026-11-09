import type { ActivityOccurrenceDTO, ActivityRule, GameSourceDTO } from '@lc/shared'
import { clockMinutes, formatDate, parseDateTime } from './time.js'

/**
 * 活动规则展开。
 *
 * 规则三类：
 *  - DAILY：每天 start~end
 *  - WEEKLY：每周 dayOfWeek（0=周日）start~end
 *  - MONTHLY_NTH：每月第 nth 个 dayOfWeek（nth=5 表示当月最后一个）start~end
 *
 * 跨零点：end <= start 视为次日结束（如 23:00~01:00）。
 */

/** 星期日=0，与 JS Date.getDay() 一致 */
export function occursOn(rule: ActivityRule, date: Date): boolean {
  if (rule.type === 'DAILY') return true
  if (date.getDay() !== rule.dayOfWeek) return false
  if (rule.type === 'WEEKLY') return true

  const day = date.getDate()
  if (rule.nth === 5) {
    // 最后一个：再往后 7 天就跨月了
    return day + 7 > new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }
  return Math.ceil(day / 7) === rule.nth
}

/** 某活动在某天的所有场次（同一天多条规则都生效时会有多条） */
export function occurrencesOf(source: GameSourceDTO, dateStr: string): ActivityOccurrenceDTO[] {
  const date = parseDateTime(dateStr)
  return source.rules
    .filter((rule) => occursOn(rule, date))
    .map((rule) => {
      const [sh, sm] = rule.start.split(':').map(Number)
      const [eh, em] = rule.end.split(':').map(Number)
      const startAt = new Date(date)
      startAt.setHours(sh, sm, 0, 0)
      const endAt = new Date(date)
      endAt.setHours(eh, em, 0, 0)
      const endsNextDay = clockMinutes(rule.end) <= clockMinutes(rule.start)
      if (endsNextDay) endAt.setDate(endAt.getDate() + 1)
      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type,
        date: dateStr,
        start: formatDateTime2(startAt),
        end: formatDateTime2(endAt),
        endsNextDay
      }
    })
}

function formatDateTime2(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`
}

/** 从 from 起 horizonDays 天内按时间排序的全部场次 */
export function upcomingOccurrences(
  sources: GameSourceDTO[],
  from: Date,
  horizonDays = 7
): ActivityOccurrenceDTO[] {
  const out: ActivityOccurrenceDTO[] = []
  const base = new Date(from)
  base.setHours(0, 0, 0, 0)
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const dateStr = formatDate(d)
    for (const s of sources) {
      if (s.status !== 'ENABLED') continue
      for (const occ of occurrencesOf(s, dateStr)) {
        if (parseDateTime(occ.end).getTime() >= from.getTime()) out.push(occ)
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/** 规则的人类可读描述（列表页展示用） */
export function describeRule(rule: ActivityRule): string {
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  if (rule.type === 'DAILY') return `每天 ${rule.start}~${rule.end}`
  if (rule.type === 'WEEKLY') return `每周${week[rule.dayOfWeek]} ${rule.start}~${rule.end}`
  const nth = rule.nth === 5 ? '最后一个' : `第 ${rule.nth} 个`
  return `每月${nth}${week[rule.dayOfWeek]} ${rule.start}~${rule.end}`
}
