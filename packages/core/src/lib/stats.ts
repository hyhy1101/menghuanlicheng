import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client.js'
import { incomeDailyStats, mileageRecords } from '../db/schema.js'

/** drizzle 事务句柄（与 Db 同形的执行面） */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type Executor = Db | Tx

/**
 * 按「归属日期」重算某天的汇总。
 *
 * 全量重算而不是增量累加：结算、改单、删单都走这里，永远不会因为漏减一次而
 * 让日统计和明细对不上。一天最多几十条记录，成本可以忽略。
 */
export async function refreshDailyStats(exec: Executor, date: string): Promise<void> {
  const [agg] = await exec
    .select({
      totalIncome: sql<number>`coalesce(sum(${mileageRecords.totalIncome}), 0)`,
      netIncome: sql<number>`coalesce(sum(${mileageRecords.netIncome}), 0)`,
      durationMinutes: sql<number>`coalesce(sum(${mileageRecords.durationMinutes}), 0)`,
      recordCount: sql<number>`count(*)`
    })
    .from(mileageRecords)
    .where(and(eq(mileageRecords.belongDate, date), eq(mileageRecords.status, 'FINISHED')))

  const row = {
    totalIncome: Number(agg?.totalIncome ?? 0),
    netIncome: Number(agg?.netIncome ?? 0),
    durationMinutes: Number(agg?.durationMinutes ?? 0),
    recordCount: Number(agg?.recordCount ?? 0)
  }

  await exec.delete(incomeDailyStats).where(eq(incomeDailyStats.statDate, date))
  if (row.recordCount > 0) {
    await exec.insert(incomeDailyStats).values({ statDate: date, ...row })
  }
}

/** 全量重算（用于从备份恢复、或用户手动"修复统计"） */
export async function refreshAllDailyStats(exec: Executor): Promise<void> {
  const rows = await exec
    .selectDistinct({ date: mileageRecords.belongDate })
    .from(mileageRecords)
    .where(eq(mileageRecords.status, 'FINISHED'))
  for (const r of rows) await refreshDailyStats(exec, r.date)
}
