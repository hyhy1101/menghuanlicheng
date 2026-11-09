/**
 * 本地日期工具：服务端 belongDate/统计查询一律使用本地时区的 YYYY-MM-DD / YYYY-MM。
 * 禁止用 toISOString()（UTC）构造日期，否则跨时区（如 UTC+8 凌晨）会查询到前一天。
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD'（本地时区） */
export function formatLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Date → 'YYYY-MM'（本地时区） */
export function formatLocalMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
