/**
 * 收益趋势的日期区间构造。
 * WEEK 返回本周 7 天、MONTH 返回当月每天、YEAR 返回当年 12 个月（points 是 'YYYY-MM'）。
 */
import { daysInMonth, mondayOf, addDays } from './time.js'

const pad = (n: number) => String(n).padStart(2, '0')

export function buildRange(
  cycleType: 'WEEK' | 'MONTH' | 'YEAR',
  date: string
): { points: string[]; keyOf: (p: string) => string } {
  if (cycleType === 'WEEK') {
    const monday = mondayOf(date)
    const points = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
    return { points, keyOf: (p) => p }
  }
  if (cycleType === 'MONTH') {
    const [y, m] = date.split('-').map(Number)
    const days = daysInMonth(y, m)
    const points = Array.from({ length: days }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`)
    return { points, keyOf: (p) => p }
  }
  const year = date.slice(0, 4)
  const points = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`)
  return { points, keyOf: (p) => p.slice(0, 7) }
}
