import { Hono } from 'hono'
import { zValidator } from '../lib/zod-validate.js'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { createTeamReqSchema, updateTeamReqSchema, type GameRoleDTO, type GameTeamDTO } from '@lc/shared'
import { db } from '../db/current.js'
import { gameRoles, gameServers, gameTeams, mileageRecords } from '../db/schema.js'
import { ApiError } from '../middleware/error.js'
import { mondayOf, nowStr, todayStr } from '../lib/time.js'

export const teamRoutes = new Hono()

const ok = <T>(data: T) => ({ code: 200, msg: 'success', data })

/* ================= 号组 ================= */

teamRoutes.get('/', async (c) => {
  const teams = await db.select().from(gameTeams).orderBy(gameTeams.id)
  if (teams.length === 0) return c.json(ok([]))
  const ids = teams.map((t) => t.id)
  const today = todayStr()
  const monday = mondayOf(today)

  const [roles, records, serverRows] = await Promise.all([
    db
      .select()
      .from(gameRoles)
      .where(and(eq(gameRoles.deleted, false), inArray(gameRoles.teamId, ids))),
    db
      .select()
      .from(mileageRecords)
      .where(and(eq(mileageRecords.status, 'FINISHED'), inArray(mileageRecords.teamId, ids))),
    db
      .select()
      .from(gameServers)
      .where(inArray(gameServers.id, [...new Set(teams.map((t) => t.serverId))]))
  ])
  const serverMap = new Map(serverRows.map((s) => [s.id, s.name]))

  const data: GameTeamDTO[] = teams.map((t) => {
    const teamRecords = records.filter((r) => r.teamId === t.id)
    const todayIncome = teamRecords.filter((r) => r.belongDate === today).reduce((s, r) => s + r.totalIncome, 0)
    const weekRecords = teamRecords.filter((r) => r.belongDate >= monday && r.belongDate <= today)
    const weekNetIncome = weekRecords.reduce((s, r) => s + r.netIncome, 0)
    const weekMinutes = weekRecords.reduce((s, r) => s + r.durationMinutes, 0)
    return {
      id: t.id,
      name: t.name,
      serverId: t.serverId,
      serverName: serverMap.get(t.serverId) ?? null,
      roleCount: roles.filter((r) => r.teamId === t.id).length,
      todayIncome,
      weekNetIncome,
      netEfficiency: weekMinutes > 0 ? Math.round(weekNetIncome / (weekMinutes / 60)) : 0,
      createTime: t.createTime
    }
  })
  return c.json(ok(data))
})

teamRoutes.post('/', zValidator('json', createTeamReqSchema), async (c) => {
  const body = c.req.valid('json')
  const [dup] = await db.select().from(gameTeams).where(eq(gameTeams.name, body.name))
  if (dup) throw new ApiError(409, '号组名称已存在')
  const [server] = await db.select().from(gameServers).where(eq(gameServers.id, body.serverId))
  if (!server) throw new ApiError(404, '服务器不存在')
  const [row] = await db
    .insert(gameTeams)
    .values({ name: body.name, serverId: body.serverId, createTime: nowStr() })
    .returning()
  if (body.roleIds?.length) {
    await db
      .update(gameRoles)
      .set({ teamId: row.id, serverId: body.serverId })
      .where(inArray(gameRoles.id, body.roleIds))
  }
  return c.json(ok({ id: row.id }))
})

teamRoutes.put('/:id', zValidator('json', updateTeamReqSchema), async (c) => {
  const id = Number(c.req.param('id'))
  const body = c.req.valid('json')
  const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, id))
  if (!team) throw new ApiError(404, '号组不存在')
  if (body.name && body.name !== team.name) {
    const [dup] = await db.select().from(gameTeams).where(eq(gameTeams.name, body.name))
    if (dup) throw new ApiError(409, '号组名称已存在')
    await db.update(gameTeams).set({ name: body.name }).where(eq(gameTeams.id, id))
  }
  if (body.roleIds) {
    await db.update(gameRoles).set({ teamId: null }).where(eq(gameRoles.teamId, id))
    if (body.roleIds.length) {
      await db.update(gameRoles).set({ teamId: id, serverId: team.serverId }).where(inArray(gameRoles.id, body.roleIds))
    }
  }
  return c.json(ok(null))
})

teamRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, id))
  if (!team) throw new ApiError(404, '号组不存在')
  const [active] = await db
    .select()
    .from(mileageRecords)
    .where(and(eq(mileageRecords.teamId, id), eq(mileageRecords.status, 'ACTIVE')))
  if (active) throw new ApiError(409, '该号组存在未结束的里程')
  await db.update(gameRoles).set({ teamId: null }).where(eq(gameRoles.teamId, id))
  await db.delete(gameTeams).where(eq(gameTeams.id, id))
  return c.json(ok(null))
})

/** 号组对比：仪表盘里的"团队对比"卡片吃这个 */
teamRoutes.get(
  '/compare',
  zValidator(
    'query',
    z.object({ rangeType: z.enum(['THIS_WEEK', 'THIS_MONTH', 'ALL']).default('THIS_WEEK') })
  ),
  async (c) => {
    const { rangeType } = c.req.valid('query')
    const teams = await db.select().from(gameTeams).orderBy(gameTeams.id)
    if (teams.length === 0) return c.json(ok([]))
    const ids = teams.map((t) => t.id)

    const today = todayStr()
    const since = rangeType === 'THIS_WEEK' ? mondayOf(today) : rangeType === 'THIS_MONTH' ? today.slice(0, 8) + '01' : null
    const conds = [eq(mileageRecords.status, 'FINISHED'), inArray(mileageRecords.teamId, ids)]
    if (since) conds.push(sql`${mileageRecords.belongDate} >= ${since}`)

    const [records, serverRows, roleCounts] = await Promise.all([
      db.select().from(mileageRecords).where(and(...conds)),
      db
        .select()
        .from(gameServers)
        .where(inArray(gameServers.id, [...new Set(teams.map((t) => t.serverId))])),
      db
        .select({ teamId: gameRoles.teamId, n: sql<number>`count(*)` })
        .from(gameRoles)
        .where(and(eq(gameRoles.deleted, false), inArray(gameRoles.teamId, ids)))
        .groupBy(gameRoles.teamId)
    ])
    const serverMap = new Map(serverRows.map((s) => [s.id, s.name]))
    const roleMap = new Map(roleCounts.map((r) => [r.teamId, Number(r.n)]))

    const data = teams.map((t) => {
      const rs = records.filter((r) => r.teamId === t.id)
      const netIncome = rs.reduce((s, r) => s + r.netIncome, 0)
      const durationMinutes = rs.reduce((s, r) => s + r.durationMinutes, 0)
      return {
        teamId: t.id,
        teamName: t.name,
        serverId: t.serverId,
        serverName: serverMap.get(t.serverId) ?? null,
        roleCount: roleMap.get(t.id) ?? 0,
        netIncome,
        durationMinutes,
        netEfficiency: durationMinutes > 0 ? Math.round(netIncome / (durationMinutes / 60)) : 0
      }
    })
    data.sort((a, b) => b.netEfficiency - a.netEfficiency)
    return c.json(ok(data))
  }
)

teamRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, id))
  if (!team) throw new ApiError(404, '号组不存在')
  const [server] = await db.select().from(gameServers).where(eq(gameServers.id, team.serverId))
  const roles = await db
    .select()
    .from(gameRoles)
    .where(and(eq(gameRoles.teamId, id), eq(gameRoles.deleted, false)))
    .orderBy(gameRoles.id)
  const roleDtos: GameRoleDTO[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    level: r.level,
    sect: r.sect,
    teamId: r.teamId,
    teamName: team.name,
    serverId: r.serverId,
    serverName: server?.name ?? null,
    createTime: r.createTime
  }))
  return c.json(
    ok({
      team: { id: team.id, name: team.name, serverId: team.serverId, serverName: server?.name ?? null },
      roles: roleDtos
    })
  )
})
