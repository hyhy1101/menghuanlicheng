import { Hono } from 'hono'
import { zValidator } from '../lib/zod-validate.js'
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import type { MileageRecordDTO } from '@lc/shared'
import { addCostReqSchema } from '@lc/shared'
import { db } from '../db/current.js'
import {
  costRecords,
  gameItems,
  gameRoles,
  gameServers,
  gameSources,
  gameTeams,
  mileageRecordDetails,
  mileageRecords
} from '../db/schema.js'
import { ApiError } from '../middleware/error.js'
import { calcDurationMinutes, calcItemValue, calcTotals } from '../lib/calc.js'
import { refreshDailyStats } from '../lib/stats.js'
import { nowStr } from '../lib/time.js'

export const recordRoutes = new Hono()

const ok = <T>(data: T) => ({ code: 200, msg: 'success', data })

const dateTimeStr = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const detailInputSchema = z.object({
  itemId: z.number().int().positive().optional(),
  name: z.string().max(100).optional(),
  sourceId: z.number().int().positive().nullish(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().int().min(0).optional(),
  direction: z.enum(['INCOME', 'COST']).default('INCOME'),
  remark: z.string().max(200).optional()
})

const createRecordSchema = z.object({
  serverId: z.number().int().positive(),
  teamId: z.number().int().positive().nullish(),
  roleId: z.number().int().positive().nullish(),
  startTime: dateTimeStr,
  endTime: dateTimeStr,
  totalSilver: z.number().int().min(0).default(0),
  belongDate: dateStr.optional(),
  details: z.array(detailInputSchema).min(1, '至少记一条收获')
})

type DetailInput = z.infer<typeof detailInputSchema>

/* ---------- 补录历史里程 ---------- */

recordRoutes.post('/', zValidator('json', createRecordSchema), async (c) => {
  const body = c.req.valid('json')
  if (body.teamId && body.roleId) throw new ApiError(400, 'teamId 与 roleId 只能二选一')
  if (body.endTime <= body.startTime) throw new ApiError(400, '结束时间必须晚于开始时间')
  const durationMinutes = calcDurationMinutes(body.startTime, body.endTime)
  if (durationMinutes > 24 * 60) throw new ApiError(400, '单条里程时长不能超过 24 小时')

  const [server] = await db.select().from(gameServers).where(eq(gameServers.id, body.serverId))
  if (!server) throw new ApiError(404, '服务器不存在')

  let roleCount = 1
  if (body.teamId) {
    const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, body.teamId))
    if (!team) throw new ApiError(404, '号组不存在')
    const roles = await db
      .select()
      .from(gameRoles)
      .where(and(eq(gameRoles.teamId, team.id), eq(gameRoles.deleted, false)))
    roleCount = Math.max(1, roles.length)
  } else if (body.roleId) {
    const [role] = await db.select().from(gameRoles).where(eq(gameRoles.id, body.roleId))
    if (!role) throw new ApiError(404, '角色不存在')
  }

  const normalized = await normalizeDetails(body.details)
  const belongDate = body.belongDate ?? body.startTime.slice(0, 10)
  const cardPrice = server.cardPrice
  const result = calcTotals({
    totalSilver: body.totalSilver,
    details: normalized,
    durationMinutes,
    roleCount,
    cardPrice,
    lossCosts: 0
  })

  const recordId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(mileageRecords)
      .values({
        teamId: body.teamId ?? null,
        roleId: body.roleId ?? null,
        serverId: body.serverId,
        startTime: body.startTime,
        endTime: body.endTime,
        durationMinutes,
        roleCount,
        totalSilver: body.totalSilver,
        itemSum: result.itemSum,
        totalIncome: result.totalIncome,
        cardPrice,
        cardCost: result.cardCost,
        lossTotal: result.lossTotal,
        netIncome: result.netIncome,
        efficiency: result.efficiency,
        netEfficiency: result.netEfficiency,
        belongDate,
        status: 'FINISHED',
        createTime: nowStr()
      })
      .returning()
    const now = nowStr()
    await tx.insert(mileageRecordDetails).values(
      normalized.map((d) => ({
        recordId: row.id,
        itemId: d.itemId ?? null,
        itemName: d.name ?? null,
        sourceId: d.sourceId ?? null,
        quantity: d.quantity,
        unitPrice: d.unitPrice ?? 0,
        itemValue: calcItemValue(d.quantity, d.unitPrice ?? 0, d.direction),
        direction: d.direction,
        remark: d.remark ?? null,
        createTime: now
      }))
    )
    await tx.insert(costRecords).values({
      recordId: row.id,
      costType: 'CARD',
      amount: result.cardCost,
      name: '点卡成本',
      remark: `${roleCount} 角色 × ${durationMinutes} 分钟 × 6 点/小时`,
      createTime: now
    })
    await refreshDailyStats(tx, belongDate)
    return row.id
  })

  return c.json(
    ok({
      recordId,
      summary: {
        durationMinutes,
        totalIncome: result.totalIncome,
        netIncome: result.netIncome,
        efficiency: result.efficiency,
        netEfficiency: result.netEfficiency
      },
      shareText: `补录 ${durationMinutes} 分钟 净收益${wan(result.netIncome)}万`
    })
  )
})

type NormalizedDetail = DetailInput & { unitPrice: number; itemId?: number; name?: string }

async function normalizeDetails(details: DetailInput[]): Promise<NormalizedDetail[]> {
  const out: NormalizedDetail[] = []
  for (const d of details) {
    const itemId = d.itemId ?? null
    let name = d.name ?? null
    if (itemId !== null) {
      const [item] = await db.select().from(gameItems).where(eq(gameItems.id, itemId))
      if (!item) throw new ApiError(404, `物品不存在: ${itemId}`)
      name = item.name
    } else if (!name) {
      throw new ApiError(400, '物品或名称必须填写一个')
    }
    if (d.sourceId != null) {
      const [source] = await db.select().from(gameSources).where(eq(gameSources.id, d.sourceId))
      if (!source) throw new ApiError(404, '玩法来源不存在')
    }
    out.push({ ...d, itemId: itemId ?? undefined, name: name ?? undefined, unitPrice: d.unitPrice ?? 0 })
  }
  return out
}

/* ---------- 记录列表 ---------- */

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  belongDate: dateStr.optional(),
  startDate: dateStr.optional(),
  endDate: dateStr.optional(),
  teamId: z.coerce.number().int().positive().optional(),
  roleId: z.coerce.number().int().positive().optional(),
  serverId: z.coerce.number().int().positive().optional(),
  keyword: z.string().optional()
})

recordRoutes.get('/', zValidator('query', listSchema), async (c) => {
  const q = c.req.valid('query')
  const conds: SQL[] = [eq(mileageRecords.status, 'FINISHED')]
  if (q.belongDate) conds.push(eq(mileageRecords.belongDate, q.belongDate))
  if (q.startDate) conds.push(sql`${mileageRecords.belongDate} >= ${q.startDate}`)
  if (q.endDate) conds.push(sql`${mileageRecords.belongDate} <= ${q.endDate}`)
  if (q.teamId) conds.push(eq(mileageRecords.teamId, q.teamId))
  if (q.roleId) conds.push(eq(mileageRecords.roleId, q.roleId))
  if (q.serverId) conds.push(eq(mileageRecords.serverId, q.serverId))
  if (q.keyword) {
    conds.push(
      sql`exists (select 1 from mileage_record_detail d where d.record_id = ${mileageRecords.id} and d.item_name like ${`%${q.keyword}%`})`
    )
  }
  const where = and(...conds)

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(mileageRecords)
      .where(where)
      .orderBy(desc(mileageRecords.belongDate), desc(mileageRecords.id))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ count: sql<number>`count(*)` }).from(mileageRecords).where(where)
  ])

  const ids = rows.map((r) => r.id)
  const [details, servers, teams, roles] = await Promise.all([
    ids.length
      ? db.select().from(mileageRecordDetails).where(inArray(mileageRecordDetails.recordId, ids))
      : Promise.resolve([]),
    ids.length
      ? db.select().from(gameServers).where(inArray(gameServers.id, [...new Set(rows.map((r) => r.serverId))]))
      : Promise.resolve([]),
    rows.some((r) => r.teamId)
      ? db
          .select()
          .from(gameTeams)
          .where(inArray(gameTeams.id, [...new Set(rows.map((r) => r.teamId).filter((v): v is number => v !== null))]))
      : Promise.resolve([]),
    rows.some((r) => r.roleId)
      ? db
          .select()
          .from(gameRoles)
          .where(inArray(gameRoles.id, [...new Set(rows.map((r) => r.roleId).filter((v): v is number => v !== null))]))
      : Promise.resolve([])
  ])
  const detailByRecord = new Map<number, typeof details>()
  for (const d of details) {
    const arr = detailByRecord.get(d.recordId) ?? []
    arr.push(d)
    detailByRecord.set(d.recordId, arr)
  }
  const serverMap = new Map(servers.map((s) => [s.id, s.name]))
  const teamMap = new Map(teams.map((t) => [t.id, t.name]))
  const roleMap = new Map(roles.map((r) => [r.id, r.name]))

  const list = rows.map((r) => {
    const ds = (detailByRecord.get(r.id) ?? []).map((d) => ({
      id: d.id,
      itemId: d.itemId,
      itemName: d.itemName,
      quantity: d.quantity,
      unitPrice: d.unitPrice,
      itemValue: d.itemValue,
      sourceId: d.sourceId,
      direction: d.direction,
      remark: d.remark
    }))
    return {
      id: r.id,
      teamId: r.teamId,
      teamName: r.teamId ? (teamMap.get(r.teamId) ?? null) : null,
      roleId: r.roleId,
      roleName: r.roleId ? (roleMap.get(r.roleId) ?? null) : null,
      serverId: r.serverId,
      serverName: serverMap.get(r.serverId) ?? null,
      status: r.status,
      startTime: r.startTime,
      endTime: r.endTime,
      durationMinutes: r.durationMinutes,
      totalSilver: r.totalSilver,
      itemSum: r.itemSum,
      totalIncome: r.totalIncome,
      cardCost: r.cardCost,
      lossTotal: r.lossTotal,
      netIncome: r.netIncome,
      efficiency: r.efficiency,
      netEfficiency: r.netEfficiency,
      belongDate: r.belongDate,
      details: ds,
      costs: [],
      createTime: r.createTime
    } as MileageRecordDTO
  })

  return c.json(
    ok({ list, total: Number(totalRows[0]?.count ?? 0), page: q.page, pageSize: q.pageSize })
  )
})

/* ---------- 记录详情 ---------- */

recordRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [row] = await db.select().from(mileageRecords).where(eq(mileageRecords.id, id))
  if (!row) throw new ApiError(404, '记录不存在')

  const [details, costs, server, team, role] = await Promise.all([
    loadDetailDTOs(id),
    db.select().from(costRecords).where(eq(costRecords.recordId, id)),
    row.serverId ? db.select().from(gameServers).where(eq(gameServers.id, row.serverId)) : Promise.resolve([]),
    row.teamId ? db.select().from(gameTeams).where(eq(gameTeams.id, row.teamId)) : Promise.resolve([]),
    row.roleId ? db.select().from(gameRoles).where(eq(gameRoles.id, row.roleId)) : Promise.resolve([])
  ])

  const dto: MileageRecordDTO = {
    id: row.id,
    teamId: row.teamId,
    teamName: team[0]?.name ?? null,
    roleId: row.roleId,
    roleName: role[0]?.name ?? null,
    serverId: row.serverId,
    serverName: server[0]?.name ?? null,
    status: row.status,
    startTime: row.startTime,
    endTime: row.endTime,
    durationMinutes: row.durationMinutes,
    totalSilver: row.totalSilver,
    itemSum: row.itemSum,
    totalIncome: row.totalIncome,
    cardCost: row.cardCost,
    lossTotal: row.lossTotal,
    netIncome: row.netIncome,
    efficiency: row.efficiency,
    netEfficiency: row.netEfficiency,
    belongDate: row.belongDate,
    details,
    costs: costs.map((x) => ({
      id: x.id,
      costType: x.costType,
      itemId: x.itemId,
      name: x.name,
      amount: x.amount,
      remark: x.remark,
      createTime: x.createTime
    })),
    createTime: row.createTime
  }
  return c.json(ok(dto))
})

async function loadDetailDTOs(recordId: number) {
  const rows = await db
    .select()
    .from(mileageRecordDetails)
    .where(eq(mileageRecordDetails.recordId, recordId))
    .orderBy(mileageRecordDetails.id)
  const itemIds = rows.map((r) => r.itemId).filter((v): v is number => v !== null)
  const sourceIds = rows.map((r) => r.sourceId).filter((v): v is number => v !== null)
  const [items, sources] = await Promise.all([
    itemIds.length ? db.select().from(gameItems).where(inArray(gameItems.id, itemIds)) : Promise.resolve([]),
    sourceIds.length ? db.select().from(gameSources).where(inArray(gameSources.id, sourceIds)) : Promise.resolve([])
  ])
  const itemMap = new Map(items.map((i) => [i.id, i]))
  const sourceMap = new Map(sources.map((s) => [s.id, s]))
  return rows.map((r) => {
    const item = r.itemId !== null ? itemMap.get(r.itemId) : undefined
    const source = r.sourceId !== null ? sourceMap.get(r.sourceId) : undefined
    return {
      id: r.id,
      itemId: r.itemId,
      itemName: item?.name ?? r.itemName,
      iconUrl: item?.iconUrl ?? null,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      itemValue: r.itemValue,
      sourceId: r.sourceId,
      source: source
        ? {
            id: source.id,
            name: source.name,
            type: source.type,
            level: source.level,
            durationDesc: source.durationDesc,
            rules: source.rules ?? [],
            intro: source.intro,
            reminder: {
              enabled: source.remindEnabled,
              beforeMinutes: source.remindBefore,
              atStart: source.remindAtStart
            },
            status: source.status,
            createTime: source.createTime
          }
        : null,
      direction: r.direction,
      remark: r.remark
    }
  })
}

/* ---------- 编辑记录 ---------- */

const editRecordSchema = z.object({
  belongDate: dateStr.optional(),
  totalSilver: z.number().int().min(0).optional(),
  startTime: dateTimeStr.optional(),
  endTime: dateTimeStr.optional(),
  details: z.array(detailInputSchema).optional()
})

recordRoutes.put('/:id', zValidator('json', editRecordSchema), async (c) => {
  const id = Number(c.req.param('id'))
  const body = c.req.valid('json')
  const [row] = await db.select().from(mileageRecords).where(eq(mileageRecords.id, id))
  if (!row || row.status !== 'FINISHED') throw new ApiError(404, '记录不存在')

  const oldDate = row.belongDate
  const belongDate = body.belongDate ?? oldDate
  const totalSilver = body.totalSilver ?? row.totalSilver
  const startTime = body.startTime ?? row.startTime
  const endTime = body.endTime ?? row.endTime
  if (endTime <= startTime) throw new ApiError(400, '结束时间必须晚于开始时间')
  const durationMinutes = calcDurationMinutes(startTime, endTime)
  if (durationMinutes > 24 * 60) throw new ApiError(400, '单条里程时长不能超过 24 小时')

  await db.transaction(async (tx) => {
    if (body.details) {
      const normalized = await normalizeDetails(body.details)
      await tx.delete(mileageRecordDetails).where(eq(mileageRecordDetails.recordId, id))
      const now = nowStr()
      if (normalized.length) {
        await tx.insert(mileageRecordDetails).values(
          normalized.map((d) => ({
            recordId: id,
            itemId: d.itemId ?? null,
            itemName: d.name ?? null,
            sourceId: d.sourceId ?? null,
            quantity: d.quantity,
            unitPrice: d.unitPrice ?? 0,
            itemValue: calcItemValue(d.quantity, d.unitPrice ?? 0, d.direction),
            direction: d.direction,
            remark: d.remark ?? null,
            createTime: now
          }))
        )
      }
    }

    const details = await tx.select().from(mileageRecordDetails).where(eq(mileageRecordDetails.recordId, id))
    const costs = await tx.select().from(costRecords).where(eq(costRecords.recordId, id))
    const lossCosts = costs.filter((x) => x.costType === 'LOSS').reduce((s, x) => s + x.amount, 0)
    const result = calcTotals({
      totalSilver,
      details,
      durationMinutes,
      roleCount: row.roleCount,
      cardPrice: row.cardPrice,
      lossCosts
    })

    await tx
      .update(mileageRecords)
      .set({
        totalSilver,
        belongDate,
        startTime,
        endTime,
        durationMinutes,
        itemSum: result.itemSum,
        totalIncome: result.totalIncome,
        cardCost: result.cardCost,
        lossTotal: result.lossTotal,
        netIncome: result.netIncome,
        efficiency: result.efficiency,
        netEfficiency: result.netEfficiency
      })
      .where(eq(mileageRecords.id, id))

    // 点卡成本行跟着重算，保持明细可追溯
    const [cardRow] = costs.filter((x) => x.costType === 'CARD')
    if (cardRow) {
      await tx.update(costRecords).set({ amount: result.cardCost }).where(eq(costRecords.id, cardRow.id))
    } else {
      await tx.insert(costRecords).values({
        recordId: id,
        costType: 'CARD',
        amount: result.cardCost,
        name: '点卡成本',
        remark: `${row.roleCount} 角色 × ${durationMinutes} 分钟 × 6 点/小时`,
        createTime: nowStr()
      })
    }

    await refreshDailyStats(tx, oldDate)
    if (belongDate !== oldDate) await refreshDailyStats(tx, belongDate)
  })

  return c.json(ok(null))
})

/* ---------- 删除记录 ---------- */

recordRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [row] = await db.select().from(mileageRecords).where(eq(mileageRecords.id, id))
  if (!row) throw new ApiError(404, '记录不存在')
  await db.transaction(async (tx) => {
    await tx.delete(mileageRecordDetails).where(eq(mileageRecordDetails.recordId, id))
    await tx.delete(costRecords).where(eq(costRecords.recordId, id))
    await tx.delete(mileageRecords).where(eq(mileageRecords.id, id))
    await refreshDailyStats(tx, row.belongDate)
  })
  return c.json(ok(null))
})

/* ---------- 追加损耗 ---------- */

recordRoutes.post('/:id/costs', zValidator('json', addCostReqSchema), async (c) => {
  const id = Number(c.req.param('id'))
  const body = c.req.valid('json')
  if (body.costType === 'CARD') throw new ApiError(422, '点卡成本由结算自动生成，不能手工添加')
  const [row] = await db.select().from(mileageRecords).where(eq(mileageRecords.id, id))
  if (!row || row.status !== 'FINISHED') throw new ApiError(404, '记录不存在')

  await db.transaction(async (tx) => {
    await tx.insert(costRecords).values({
      recordId: id,
      costType: body.costType,
      itemId: body.itemId ?? null,
      name: body.name ?? null,
      amount: body.amount,
      remark: body.remark ?? null,
      createTime: nowStr()
    })
    await recomputeRecord(tx, id)
    await refreshDailyStats(tx, row.belongDate)
  })
  return c.json(ok(null))
})

recordRoutes.delete('/:id/costs/:cid', async (c) => {
  const id = Number(c.req.param('id'))
  const cid = Number(c.req.param('cid'))
  const [row] = await db.select().from(mileageRecords).where(eq(mileageRecords.id, id))
  if (!row) throw new ApiError(404, '记录不存在')
  const [cost] = await db.select().from(costRecords).where(and(eq(costRecords.id, cid), eq(costRecords.recordId, id)))
  if (!cost) throw new ApiError(404, '成本不存在')
  if (cost.costType === 'CARD') throw new ApiError(422, '点卡成本不能单独删除')
  await db.transaction(async (tx) => {
    await tx.delete(costRecords).where(eq(costRecords.id, cid))
    await recomputeRecord(tx, id)
    await refreshDailyStats(tx, row.belongDate)
  })
  return c.json(ok(null))
})

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** 用当前明细 + 成本重算一条已结算记录 */
async function recomputeRecord(tx: Tx, recordId: number): Promise<void> {
  const [row] = await tx.select().from(mileageRecords).where(eq(mileageRecords.id, recordId))
  if (!row) return
  const details = await tx.select().from(mileageRecordDetails).where(eq(mileageRecordDetails.recordId, recordId))
  const costs = await tx.select().from(costRecords).where(eq(costRecords.recordId, recordId))
  const lossCosts = costs.filter((x) => x.costType === 'LOSS').reduce((s, x) => s + x.amount, 0)
  const result = calcTotals({
    totalSilver: row.totalSilver,
    details,
    durationMinutes: row.durationMinutes,
    roleCount: row.roleCount,
    cardPrice: row.cardPrice,
    lossCosts
  })
  await tx
    .update(mileageRecords)
    .set({
      itemSum: result.itemSum,
      totalIncome: result.totalIncome,
      cardCost: result.cardCost,
      lossTotal: result.lossTotal,
      netIncome: result.netIncome,
      efficiency: result.efficiency,
      netEfficiency: result.netEfficiency
    })
    .where(eq(mileageRecords.id, recordId))
}

function wan(v: number): string {
  return (v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}
