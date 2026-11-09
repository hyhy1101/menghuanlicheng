/**
 * 客户端共享格式化工具：全站统一"万"单位展示（消除各视图重复的 fmt/fmtWan）。
 */
export function fmtWan(v: number, maxFractionDigits = 1): string {
  return (v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: maxFractionDigits })
}

/** 物品价格分级颜色 class：万级蓝 / 十万级绿 / 百万级红 / 千万级紫（按两数值） */
export function priceTierClass(v: number): string {
  if (v >= 10000000) return 'tier-1000w'
  if (v >= 1000000) return 'tier-100w'
  if (v >= 100000) return 'tier-10w'
  if (v >= 10000) return 'tier-w'
  return ''
}

export function fmtHours(minutes: number): string {
  return (minutes / 60).toFixed(1)
}
