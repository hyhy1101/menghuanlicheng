import { Hono } from 'hono'
import { zValidator } from '../lib/zod-validate.js'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import type {
  DailySummaryDTO,
  IncomeTrendPoint,
  ItemAcquisitionItem,
  SourceRankingItem
} from '@lc/shared'
import { db } from '../db/current.js'
import { gameSources, incomeDailyStats, mileageRecordDetails, mileageRecords } from '../db/schema.js'
import { buildRange } from '../lib/range.js'
import { mondayOf, todayStr } from '../lib/time.js'

export const statisticsRoutes = new Hono()

const ok = <T>(data: T) => ({ code: 200, msg: 'success', data })

/** 区间起点（含当天）：本周一 / 本月 1 号；ALL 无起点 */
function rangeSince(rangeType: 'THIS_WEEK' | 'THIS_MONTH' | 'ALL'): string | null {
  const today = todayStr()
  if (rangeType === 'THIS_WEEK') return mondayOf(today)
  if (rangeType === 'THIS_MONTH') return `${today.slice(0, 8)}01`
  return null
}

/* ================= 收益曲线（周/月/年） ================= */

statisticsRoutes.get(
  '/income-trend',
  zValidator('query', z.object({ cycleType: z.enum(['WEEK', 'MONTH', 'YEAR']), date: z.string() })),
  async (c) => {
    const { cycleType, date } = c.req.valid('query')
    const { points, keyOf } = buildRange(cycleType, date)
    const from = points[0]
    const to = points[points.length - 1]

    const isYear = cycleType === 'YEAR'
    const keyExpr = isYear
      ? sql<string>`substr(${incomeDailyStats.statDate}, 1, 7)`
      : incomeDailyStats.statDate

    const rows = await db
      .select({
        key: keyExpr,
        totalIncome: sql<number>`sum(${incomeDailyStats.totalIncome})`,
        netIncome: sql<number>`sum(${incomeDailyStats.netIncome})`,
        durationMinutes: sql<number>`sum(${incomeDailyStats.durationMinutes})`,
        recordCount: sql<number>`sum(${incomeDailyStats.recordCount})`
      })
      .from(incomeDailyStats)
      .where(
        and(
          gte(incomeDailyStats.statDate, isYear ? `${from}-01` : from),
          lte(incomeDailyStats.statDate, isYear ? `${to}-31` : to)
        )
      )
      .groupBy(keyExpr)

    const map = new Map(rows.map((r) => [r.key, r]))
    const data: IncomeTrendPoint[] = points.map((p) => {
      const row = map.get(keyOf(p))
      return {
        date: p,
        totalIncome: Number(row?.totalIncome ?? 0),
        netIncome: Number(row?.netIncome ?? 0),
        durationMinutes: Number(row?.durationMinutes ?? 0),
        recordCount: Number(row?.recordCount ?? 0)
      }
    })
    return c.json(ok(data))
  }
)

/* ================= 今日概览 ================= */

statisticsRoutes.get(
  '/daily-summary',
  zValidator('query', z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
  async (c) => {
    const { date } = c.req.valid('query')
    const [row] = await db.select().from(incomeDailyStats).where(eq(incomeDailyStats.statDate, date))
    const activeRows = await db
      .select({ id: mileageRecords.id })
      .from(mileageRecords)
      .where(eq(mileageRecords.status, 'ACTIVE'))
    const totalIncome = Number(row?.totalIncome ?? 0)
    const durationMinutes = Number(row?.durationMinutes ?? 0)
    const summary: DailySummaryDTO = {
      totalIncome,
      netIncome: Number(row?.netIncome ?? 0),
      durationMinutes,
      efficiency: durationMinutes > 0 ? Math.round(totalIncome / (durationMinutes / 60)) : 0,
      recordCount: Number(row?.recordCount ?? 0),
      activeSessionCount: activeRows.length
    }
    return c.json(ok(summary))
  }
)

/* ================= 玩法收益率排行 ================= */

statisticsRoutes.get(
  '/source-ranking',
  zValidator(
    'query',
    z.object({
      rangeType: z.enum(['THIS_WEEK', 'THIS_MONTH', 'ALL']).default('THIS_WEEK'),
      limit: z.coerce.number().int().min(1).max(50).default(20)
    })
  ),
  async (c) => {
    const { rangeType, limit } = c.req.valid('query')
    const since = rangeSince(rangeType)
    const conds = [eq(mileageRecords.status, 'FINISHED')]
    if (since) conds.push(sql`${mileageRecords.belongDate} >= ${since}`)

    const records = await db
      .select()
      .from(mileageRecords)
      .where(and(...conds))
      .orderBy(desc(mileageRecords.startTime))
    if (records.length === 0) return c.json(ok([]))

    const recordIds = records.map((r) => r.id)
    const details = await db
      .select()
      .from(mileageRecordDetails)
      .where(
        and(
          sql`${mileageRecordDetails.recordId} in (${sql.join(recordIds, sql`, `)})`,
          eq(mileageRecordDetails.direction, 'INCOME')
        )
      )

    // 主来源：每条记录取 itemValue 最大的 INCOME 明细
    const best = new Map<number, { value: number; sourceId: number | null }>()
    for (const d of details) {
      const cur = best.get(d.recordId)
      if (!cur || d.itemValue > cur.value) best.set(d.recordId, { value: d.itemValue, sourceId: d.sourceId })
    }
    const primaryByRecord = new Map<number, number | null>()
    for (const [rid, v] of best) primaryByRecord.set(rid, v.sourceId)

    const bySource = new Map<number, (typeof records)[number][]>()
    for (const r of records) {
      const sourceId = primaryByRecord.get(r.id)
      if (!sourceId) continue
      const arr = bySource.get(sourceId) ?? []
      arr.push(r)
      bySource.set(sourceId, arr)
    }

    const sourceIds = [...bySource.keys()]
    const sources = sourceIds.length
      ? await db
          .select()
          .from(gameSources)
          .where(sql`${gameSources.id} in (${sql.join(sourceIds, sql`, `)})`)
      : []
    const sourceMap = new Map(sources.map((s) => [s.id, s]))

    const result: SourceRankingItem[] = []
    for (const [sourceId, samples] of bySource) {
      const src = sourceMap.get(sourceId)
      if (!src) continue
      const recent = samples.slice(0, 10)
      if (recent.length === 0) continue

      const perHour = (r: (typeof records)[number]) => r.netIncome / Math.max(1, r.durationMinutes / 60)
      const values = recent.map(perHour).sort((a, b) => a - b)
      const q1 = pct(values, 0.25)
      const q3 = pct(values, 0.75)
      const iqr = q3 - q1
      // 去掉明显跑偏的场次（挂机、掉线），避免均值被一两条脏数据带跑
      const clean = recent.filter((r) => {
        const v = perHour(r)
        return v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr
      })
      if (clean.length === 0) continue

      const totalNet = clean.reduce((s, r) => s + r.netIncome, 0)
      const totalMinutes = clean.reduce((s, r) => s + r.durationMinutes, 0)
      const avgOf = (arr: typeof clean) => {
        if (!arr.length) return 0
        const net = arr.reduce((s, r) => s + r.netIncome, 0)
        const min = arr.reduce((s, r) => s + r.durationMinutes, 0)
        return min > 0 ? net / (min / 60) : 0
      }
      const first5 = clean.slice(0, 5)
      const next5 = clean.slice(5, 10)
      const trend: 'UP' | 'DOWN' | 'STABLE' =
        next5.length === 0 ? 'STABLE' : avgOf(first5) > avgOf(next5) * 1.1 ? 'UP' : avgOf(first5) < avgOf(next5) * 0.9 ? 'DOWN' : 'STABLE'

      result.push({
        sourceId,
        sourceName: src.name,
        sourceType: src.type,
        avgNetIncomePerHour: totalMinutes > 0 ? Math.round(totalNet / (totalMinutes / 60)) : 0,
        totalNetIncome: totalNet,
        totalIncome: clean.reduce((s, r) => s + r.totalIncome, 0),
        totalDurationMinutes: totalMinutes,
        recordCount: clean.length,
        trend,
        samples: clean.map((r) => ({ recordId: r.id, netIncome: r.netIncome, durationMinutes: r.durationMinutes }))
      })
    }

    result.sort((a, b) => b.avgNetIncomePerHour - a.avgNetIncomePerHour)
    return c.json(ok(result.slice(0, limit)))
  }
)

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/* ================= 物品获取对比 ================= */

statisticsRoutes.get(
  '/item-acquisition',
  zValidator(
    'query',
    z.object({
      rangeType: z.enum(['THIS_WEEK', 'THIS_MONTH', 'ALL']).default('THIS_MONTH'),
      limit: z.coerce.number().int().min(1).max(50).default(15)
    })
  ),
  async (c) => {
    const { rangeType, limit } = c.req.valid('query')
    const since = rangeSince(rangeType)

    const conds = [eq(mileageRecords.status, 'FINISHED'), eq(mileageRecordDetails.direction, 'INCOME')]
    if (since) conds.push(sql`${mileageRecords.belongDate} >= ${since}`)

    // itemId 可能为空（自由填写物品名）；名称也空时归到"未命名物品"，避免同组被拆散
    const nameExpr = sql<string>`coalesce(${mileageRecordDetails.itemName}, '未命名物品')`
    const valueExpr = sql<number>`sum(${mileageRecordDetails.itemValue})`
    const rows = await db
      .select({
        itemId: mileageRecordDetails.itemId,
        itemName: nameExpr,
        quantity: sql<number>`sum(${mileageRecordDetails.quantity})`,
        itemValue: valueExpr,
        recordCount: sql<number>`count(distinct ${mileageRecordDetails.recordId})`
      })
      .from(mileageRecordDetails)
      .innerJoin(mileageRecords, eq(mileageRecordDetails.recordId, mileageRecords.id))
      .where(and(...conds))
      .groupBy(mileageRecordDetails.itemId, nameExpr)
      .orderBy(desc(valueExpr))
      .limit(limit)

    const data: ItemAcquisitionItem[] = rows.map((r) => ({
      itemId: r.itemId,
      itemName: r.itemName,
      quantity: Number(r.quantity),
      itemValue: Number(r.itemValue),
      recordCount: Number(r.recordCount)
    }))
    return c.json(ok(data))
  }
)
