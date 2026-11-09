/** 时间工具：全库统一使用本地墙钟字符串，不做时区换算 */

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD HH:mm:ss' */
export function formatDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Date → 'YYYY-MM-DD' */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nowStr(): string {
  return formatDateTime(new Date())
}

export function todayStr(): string {
  return formatDate(new Date())
}

/** 'YYYY-MM-DD[ HH:mm:ss]' → Date（本地时区解析） */
export function parseDateTime(s: string): Date {
  return new Date(s.replace(' ', 'T'))
}

/** 'HH:mm' → 当天第几分钟 */
export function clockMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateTime(dateStr)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

/** 本周一（本地） */
export function mondayOf(dateStr: string): string {
  const d = parseDateTime(dateStr)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return formatDate(d)
}

/** 当月天数 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** 与某个时刻相差的分钟数（向上取整，最小 1） */
export function minutesBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 60_000))
}
