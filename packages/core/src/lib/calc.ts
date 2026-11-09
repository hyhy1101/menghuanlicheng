/**
 * 里程核算公式（纯函数，口径与原线上版一致，勿改）。
 * 金额一律取整（四舍五入到「两」）。
 */
import type { DetailDirection } from '@lc/shared'
import { parseDateTime } from './time.js'

export interface CalcDetail {
  quantity: number
  unitPrice: number
  direction: DetailDirection
}

export interface CalcInput {
  totalSilver: number
  details: CalcDetail[]
  durationMinutes: number
  roleCount: number
  cardPrice: number // 两/点
  lossCosts: number // 额外损耗成本（cost_record LOSS）
}

export interface CalcResult {
  itemSum: number
  totalIncome: number
  cardCost: number
  lossTotal: number
  netIncome: number
  efficiency: number
  netEfficiency: number
}

export const POINT_CARD_PER_HOUR = 6 // 点卡：6点/小时
export const DEFAULT_CARD_PRICE = 12800

export function calcItemValue(quantity: number, unitPrice: number, direction: DetailDirection): number {
  const v = Math.round(quantity * unitPrice)
  return direction === 'COST' ? -v : v
}

/** 接受 Date 或 'YYYY-MM-DD HH:mm:ss'；按本地墙钟解析，跨零点自然为负则应校验在前 */
export function calcDurationMinutes(start: Date | string, end: Date | string): number {
  const a = typeof start === 'string' ? parseDateTime(start) : start
  const b = typeof end === 'string' ? parseDateTime(end) : end
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 60_000))
}

export function calcCardCost(durationMinutes: number, roleCount: number, cardPrice: number): number {
  return Math.round((durationMinutes / 60) * roleCount * POINT_CARD_PER_HOUR * cardPrice)
}

export function calcTotals(input: CalcInput): CalcResult {
  const itemSum = input.details
    .filter((d) => d.direction === 'INCOME')
    .reduce((sum, d) => sum + calcItemValue(d.quantity, d.unitPrice, d.direction), 0)

  const totalIncome = input.totalSilver + itemSum

  const detailLoss = Math.abs(
    input.details
      .filter((d) => d.direction === 'COST')
      .reduce((sum, d) => sum + calcItemValue(d.quantity, d.unitPrice, d.direction), 0)
  )
  const lossTotal = detailLoss + input.lossCosts

  const cardCost = calcCardCost(input.durationMinutes, input.roleCount, input.cardPrice)
  const netIncome = totalIncome - cardCost - lossTotal

  const durationHours = input.durationMinutes / 60
  const efficiency = Math.round(totalIncome / durationHours)
  const netEfficiency = Math.round(netIncome / durationHours)

  return { itemSum, totalIncome, cardCost, lossTotal, netIncome, efficiency, netEfficiency }
}
