import { Hono } from 'hono'
import { zValidator } from '../lib/zod-validate.js'
import { and, asc, eq, inArray, max } from 'drizzle-orm'
import type { MileageDetailDTO, MileageSessionDTO, TotalsDTO } from '@lc/shared'
import { z } from 'zod'
import {
  addDetailReqSchema,
  createSessionReqSchema,
  endSessionReqSchema,
  setActivityReqSchema,
  updateDetailReqSchema
} from '@lc/shared'
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
import { getItemPrice } from '../lib/price.js'
import { refreshDailyStats } from '../lib/stats.js'
import { formatDate, nowStr, parseDateTime } from '../lib/time.js'

export const sessionRoutes = new Hono()

const ok = <T>(data: T) => ({ code: 200, msg: 'success', data })

type RecordRow = typeof mileageRecords.$inferSelect

/* ---------- 工具 ---------- */

async function getActiveSessions(): Promise<RecordRow[]> {
  return db
    .select()
    .from(mileageRecords)
    .where(eq(mileageRecords.status, 'ACTIVE'))
    .orderBy(asc(mileageRecords.startTime))
}

/**
 * 同一 scope 内是否已有进行中的会话。scope 二选一：
 * 号组记录按 teamId 判重，单角色记录按 roleId 判重 —— 不同号组可以同时计时。
 */
async function findActiveInScope(scope: { teamId?: number | null; roleId?: number | null }) {
  const scopeCond =
    scope.teamId != null ? eq(mileageRecords.teamId, scope.teamId) : eq(mileageRecords.roleId, scope.roleId!)
  const [row] = await db
    .select()
    .from(mileageRecords)
    .where(and(eq(mileageRecords.status, 'ACTIVE'), scopeCond))
  return row ?? null
}

async function getOwnedSession(sessionId: number): Promise<RecordRow> {
  const [row] = await db.select().from(mileageRecords).where(eq(mileageRecords.id, sessionId))
  if (!row) throw new ApiError(404, '会话不存在')
  if (row.status !== 'ACTIVE') throw new ApiError(422, '会话不存在或已结束')
  return row
}

async function lastDetailCreateTime(recordId: number): Promise<string | null> {
  const [row] = await db
    .select({ last: max(mileageRecordDetails.createTime) })
    .from(mileageRecordDetails)
    .where(eq(mileageRecordDetails.recordId, recordId))
  return row?.last ?? null
}

async function loadDetails(recordId: number): Promise<MileageDetailDTO[]> {
  const rows = await db
    .select()
    .from(mileageRecordDetails)
    .where(eq(mileageRecordDetails.recordId, recordId))
    .orderBy(asc(mileageRecordDetails.createTime), asc(mileageRecordDetails.id))

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

/** 会话实时汇总。点卡价用开场时的快照（session.cardPrice），改服务器价格只影响新会话。 */
function liveTotals(session: RecordRow, details: MileageDetailDTO[]) {
  const now = nowStr()
  const durationMinutes = calcDurationMinutes(session.startTime, now)
  const lossCosts = 0
  const result = calcTotals({
    totalSilver: session.totalSilver,
    details,
    durationMinutes,
    roleCount: session.roleCount,
    cardPrice: session.cardPrice,
    lossCosts
  })
  return { ...result, cardPrice: session.cardPrice, elapsedMinutes: durationMinutes }
}

function toSessionDTO(
  row: RecordRow,
  details: MileageDetailDTO[],
  t: ReturnType<typeof liveTotals>,
  extra: {
    teamName?: string | null
    roleName?: string | null
    serverName?: string | null
    currentSource?: { id: number; name: string } | null
    lastActivityAt: string
  }
): MileageSessionDTO {
  return {
    id: row.id,
    serverId: row.serverId,
    serverName: extra.serverName ?? null,
    teamId: row.teamId,
    teamName: extra.teamName ?? null,
    roleId: row.roleId,
    roleName: extra.roleName ?? null,
    roleCount: row.roleCount,
    status: 'ACTIVE',
    startTime: row.startTime,
    lastActivityAt: extra.lastActivityAt,
    totalSilver: row.totalSilver,
    itemSum: t.itemSum,
    totalIncome: t.totalIncome,
    cardCost: t.cardCost,
    cardPrice: t.cardPrice,
    lossTotal: t.lossTotal,
    netIncome: t.netIncome,
    netEfficiency: t.netEfficiency,
    elapsedMinutes: t.elapsedMinutes,
    currentSource: extra.currentSource ?? null,
    details
  }
}

async function currentSourceInfo(row: RecordRow): Promise<{ id: number; name: string } | null> {
  if (row.currentSourceId == null) return null
  const [source] = await db.select().from(gameSources).where(eq(gameSources.id, row.currentSourceId))
  return source ? { id: source.id, name: source.name } : null
}

async function buildSessionDTO(
  session: RecordRow,
  details: MileageDetailDTO[],
  t: ReturnType<typeof liveTotals>
): Promise<MileageSessionDTO> {
  let teamName: string | null = null
  let roleName: string | null = null
  if (session.teamId) {
    const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, session.teamId))
    teamName = team?.name ?? null
  } else if (session.roleId) {
    const [role] = await db.select().from(gameRoles).where(eq(gameRoles.id, session.roleId))
    roleName = role?.name ?? null
  }
  const [server] = await db.select().from(gameServers).where(eq(gameServers.id, session.serverId))
  const currentSource = await currentSourceInfo(session)
  const lastActivity = (await lastDetailCreateTime(session.id)) ?? session.startTime
  return toSessionDTO(session, details, t, {
    teamName,
    roleName,
    serverName: server?.name ?? null,
    currentSource,
    lastActivityAt: lastActivity
  })
}

/** 明细入库：单价缺省时按「固定价格物品的用户录入价」补齐，其余必须前端带上成交价 */
async function persistDetail(
  session: RecordRow,
  input: {
    itemId?: number
    itemName?: string
    sourceId?: number | null
    quantity: number
    unitPrice?: number
    direction: 'INCOME' | 'COST'
    remark?: string
  }
): Promise<number> {
  const itemId = input.itemId ?? null
  let itemName = input.itemName ?? null
  let unitPrice = input.unitPrice

  if (itemId !== null) {
    const [item] = await db.select().from(gameItems).where(eq(gameItems.id, itemId))
    if (!item) throw new ApiError(404, '物品不存在')
    itemName = item.name
    if (unitPrice === undefined) {
      if (!item.isFixedPrice) throw new ApiError(422, '该物品非固定价格，请填写本次成交单价')
      const price = await getItemPrice(db, item.id, session.serverId)
      if (!price || price.userPrice == null) {
        throw new ApiError(422, `「${item.name}」还没有维护价格，先填一下`)
      }
      unitPrice = price.userPrice
    }
  } else if (unitPrice === undefined) {
    unitPrice = 0
  }
  if (!itemId && !itemName) throw new ApiError(400, '物品或名称必须填写一个')

  const sourceId = input.sourceId === undefined ? (session.currentSourceId ?? null) : (input.sourceId ?? null)
  if (sourceId !== null) {
    const [source] = await db.select().from(gameSources).where(eq(gameSources.id, sourceId))
    if (!source) throw new ApiError(404, '玩法来源不存在')
  }

  // 每条收获独立成行，不合并：浮动价格物品每次成交价不同，合并会让单价失真
  const itemValue = calcItemValue(input.quantity, unitPrice, input.direction)
  const [row] = await db
    .insert(mileageRecordDetails)
    .values({
      recordId: session.id,
      itemId,
      itemName,
      sourceId,
      quantity: input.quantity,
      unitPrice,
      itemValue,
      direction: input.direction,
      remark: input.remark ?? null,
      createTime: nowStr()
    })
    .returning()
  return row.id
}

/* ================= 开始今日里程 ================= */

sessionRoutes.post('/', zValidator('json', createSessionReqSchema), async (c) => {
  const body = c.req.valid('json')
  if (body.teamId && body.roleId) throw new ApiError(400, 'teamId 与 roleId 只能二选一')
  if (!body.teamId && !body.roleId) throw new ApiError(400, '请选择号组或角色')

  const existing = await findActiveInScope({ teamId: body.teamId, roleId: body.roleId })
  if (existing) throw new ApiError(409, body.teamId ? '该号组已有进行中的里程' : '该角色已有进行中的里程')

  let roleCount = 1
  let serverId: number

  if (body.teamId) {
    const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, body.teamId))
    if (!team) throw new ApiError(404, '号组不存在')
    serverId = team.serverId
    const roles = await db
      .select()
      .from(gameRoles)
      .where(and(eq(gameRoles.teamId, team.id), eq(gameRoles.deleted, false)))
    roleCount = Math.max(1, roles.length)
  } else {
    const roleId = body.roleId!
    const [role] = await db.select().from(gameRoles).where(eq(gameRoles.id, roleId))
    if (!role) throw new ApiError(404, '角色不存在')
    serverId = role.serverId
  }
  const serverRow = (await db.select().from(gameServers).where(eq(gameServers.id, serverId)))[0]
  if (!serverRow) throw new ApiError(404, '服务器不存在')

  const startTime = body.startTime ?? nowStr()
  const [inserted] = await db
    .insert(mileageRecords)
    .values({
      teamId: body.teamId ?? null,
      roleId: body.roleId ?? null,
      serverId,
      startTime,
      endTime: startTime,
      durationMinutes: 0,
      roleCount,
      totalSilver: 0,
      itemSum: 0,
      totalIncome: 0,
      cardPrice: serverRow.cardPrice,
      cardCost: 0,
      lossTotal: 0,
      netIncome: 0,
      efficiency: 0,
      netEfficiency: 0,
      belongDate: formatDate(parseDateTime(startTime)),
      status: 'ACTIVE',
      createTime: nowStr()
    })
    .returning()

  const details: MileageDetailDTO[] = []
  const t = liveTotals(inserted, details)
  const dto = await buildSessionDTO(inserted, details, t)
  return c.json(ok({ session: dto }))
})

/* ================= 进行中会话（崩溃恢复） ================= */

sessionRoutes.get('/active', async (c) => {
  const rows = await getActiveSessions()
  const sessions = await Promise.all(
    rows.map(async (row) => {
      const details = await loadDetails(row.id)
      return buildSessionDTO(row, details, liveTotals(row, details))
    })
  )
  return c.json(ok({ sessions }))
})

/* ================= 添加明细 ================= */

sessionRoutes.post('/:id/details', zValidator('json', addDetailReqSchema), async (c) => {
  const sessionId = Number(c.req.param('id'))
  const body = c.req.valid('json')
  const session = await getOwnedSession(sessionId)

  const detailId = await persistDetail(session, body)
  const details = await loadDetails(session.id)
  const t = liveTotals(session, details)
  const detail = details.find((d) => d.id === detailId)!
  return c.json(ok({ detail, totals: totalsDto(t, session.totalSilver) }))
})

/* ================= 编辑/删除明细 ================= */

sessionRoutes.put('/:id/details/:did', zValidator('json', updateDetailReqSchema), async (c) => {
  const sessionId = Number(c.req.param('id'))
  const detailId = Number(c.req.param('did'))
  const body = c.req.valid('json')
  const session = await getOwnedSession(sessionId)

  const [existing] = await db
    .select()
    .from(mileageRecordDetails)
    .where(and(eq(mileageRecordDetails.id, detailId), eq(mileageRecordDetails.recordId, sessionId)))
  if (!existing) throw new ApiError(404, '明细不存在')

  const quantity = body.quantity ?? existing.quantity
  const unitPrice = body.unitPrice ?? existing.unitPrice
  const itemValue = calcItemValue(quantity, unitPrice, existing.direction)
  await db
    .update(mileageRecordDetails)
    .set({
      quantity,
      unitPrice,
      itemValue,
      sourceId: body.sourceId !== undefined ? (body.sourceId ?? null) : existing.sourceId,
      remark: body.remark !== undefined ? body.remark : existing.remark
    })
    .where(eq(mileageRecordDetails.id, detailId))

  const details = await loadDetails(session.id)
  const t = liveTotals(session, details)
  return c.json(ok({ detail: details.find((d) => d.id === detailId)!, totals: totalsDto(t, session.totalSilver) }))
})

sessionRoutes.delete('/:id/details/:did', async (c) => {
  const sessionId = Number(c.req.param('id'))
  const detailId = Number(c.req.param('did'))
  const session = await getOwnedSession(sessionId)
  await db
    .delete(mileageRecordDetails)
    .where(and(eq(mileageRecordDetails.id, detailId), eq(mileageRecordDetails.recordId, sessionId)))
  const details = await loadDetails(session.id)
  const t = liveTotals(session, details)
  return c.json(ok({ totals: totalsDto(t, session.totalSilver) }))
})

/* ================= 总银两 ================= */

sessionRoutes.put(
  '/:id/total-silver',
  zValidator('json', z.object({ totalSilver: z.number().int().min(0) })),
  async (c) => {
    const sessionId = Number(c.req.param('id'))
    const { totalSilver } = c.req.valid('json')
    const session = await getOwnedSession(sessionId)
    await db.update(mileageRecords).set({ totalSilver }).where(eq(mileageRecords.id, sessionId))
    session.totalSilver = totalSilver
    const details = await loadDetails(session.id)
    const t = liveTotals(session, details)
    return c.json(ok({ totals: totalsDto(t, session.totalSilver) }))
  }
)

/* ================= 切换当前活动 ================= */

sessionRoutes.put('/:id/activity', zValidator('json', setActivityReqSchema), async (c) => {
  const sessionId = Number(c.req.param('id'))
  const { sourceId } = c.req.valid('json')
  const session = await getOwnedSession(sessionId)

  if (sourceId !== null) {
    const [source] = await db.select().from(gameSources).where(eq(gameSources.id, sourceId))
    if (!source) throw new ApiError(404, '玩法来源不存在')
  }
  await db.update(mileageRecords).set({ currentSourceId: sourceId }).where(eq(mileageRecords.id, sessionId))
  session.currentSourceId = sourceId

  const details = await loadDetails(session.id)
  const dto = await buildSessionDTO(session, details, liveTotals(session, details))
  return c.json(ok({ session: dto }))
})

/* ================= 结束并保存 ================= */

sessionRoutes.post('/:id/end', zValidator('json', endSessionReqSchema), async (c) => {
  const sessionId = Number(c.req.param('id'))
  const body = c.req.valid('json')
  const session = await getOwnedSession(sessionId)

  const endTime = body.endTime ?? nowStr()
  const totalSilver = body.totalSilver ?? session.totalSilver
  const belongDate = body.belongDate ?? session.belongDate
  const durationMinutes = calcDurationMinutes(session.startTime, endTime)

  const details = await loadDetails(session.id)
  const result = calcTotals({
    totalSilver,
    details,
    durationMinutes,
    roleCount: session.roleCount,
    cardPrice: session.cardPrice,
    lossCosts: 0
  })

  // 原子结算：记录更新 + 点卡成本 + 日统计在一个事务内完成
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(mileageRecords)
      .set({
        endTime,
        durationMinutes,
        totalSilver,
        itemSum: result.itemSum,
        totalIncome: result.totalIncome,
        cardCost: result.cardCost,
        lossTotal: result.lossTotal,
        netIncome: result.netIncome,
        efficiency: result.efficiency,
        netEfficiency: result.netEfficiency,
        belongDate,
        status: 'FINISHED'
      })
      .where(and(eq(mileageRecords.id, sessionId), eq(mileageRecords.status, 'ACTIVE')))
      .returning({ id: mileageRecords.id })

    if (updated.length === 0) throw new ApiError(422, '会话不存在或已结束')

    await tx.insert(costRecords).values({
      recordId: sessionId,
      costType: 'CARD',
      amount: result.cardCost,
      name: '点卡成本',
      remark: `${session.roleCount} 角色 × ${durationMinutes} 分钟 × 6 点/小时`,
      createTime: nowStr()
    })

    await refreshDailyStats(tx, belongDate)
  })

  const teamName = session.teamId
    ? (await db.select().from(gameTeams).where(eq(gameTeams.id, session.teamId)))[0]?.name
    : null
  const roleName = session.roleId
    ? (await db.select().from(gameRoles).where(eq(gameRoles.id, session.roleId)))[0]?.name
    : null
  const label = teamName ?? roleName ?? ''
  const hours = (durationMinutes / 60).toFixed(1)
  const shareText = `${label} 本次${hours}h 净收益${wan(result.netIncome)}万(${wan(result.netEfficiency)}万/小时)`

  return c.json(
    ok({
      recordId: sessionId,
      summary: {
        durationMinutes,
        totalIncome: result.totalIncome,
        netIncome: result.netIncome,
        efficiency: result.efficiency,
        netEfficiency: result.netEfficiency
      },
      shareText
    })
  )
})

/* ================= 放弃会话 ================= */

sessionRoutes.delete('/:id', async (c) => {
  const sessionId = Number(c.req.param('id'))
  await getOwnedSession(sessionId)
  await db.update(mileageRecords).set({ status: 'DISCARDED' }).where(eq(mileageRecords.id, sessionId))
  return c.json(ok(null))
})

/* ---------- helpers ---------- */

function totalsDto(t: ReturnType<typeof liveTotals>, totalSilver: number): TotalsDTO {
  return {
    itemSum: t.itemSum,
    totalSilver,
    totalIncome: t.totalIncome,
    cardCost: t.cardCost,
    cardPrice: t.cardPrice,
    lossTotal: t.lossTotal,
    netIncome: t.netIncome,
    netEfficiency: t.netEfficiency
  }
}

function wan(v: number): string {
  return (v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}
