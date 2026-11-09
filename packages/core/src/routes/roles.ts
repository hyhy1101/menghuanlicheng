import { Hono } from 'hono'
import { zValidator } from '../lib/zod-validate.js'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { createRoleReqSchema, updateRoleReqSchema, type GameRoleDTO } from '@lc/shared'
import { db } from '../db/current.js'
import { gameRoles, gameServers, gameTeams, mileageRecords } from '../db/schema.js'
import { ApiError } from '../middleware/error.js'
import { nowStr } from '../lib/time.js'

export const roleRoutes = new Hono()

const ok = <T>(data: T) => ({ code: 200, msg: 'success', data })

roleRoutes.get('/', async (c) => {
  const rows = await db
    .select()
    .from(gameRoles)
    .where(eq(gameRoles.deleted, false))
    .orderBy(gameRoles.id)
  const teams = await db.select().from(gameTeams)
  const teamMap = new Map(teams.map((t) => [t.id, t.name]))
  const serverIds = [...new Set(rows.map((r) => r.serverId))]
  const serverRows = serverIds.length
    ? await db.select().from(gameServers).where(inArray(gameServers.id, serverIds))
    : []
  const serverMap = new Map(serverRows.map((s) => [s.id, s.name]))
  const dto: GameRoleDTO[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    level: r.level,
    sect: r.sect,
    teamId: r.teamId,
    teamName: r.teamId ? (teamMap.get(r.teamId) ?? null) : null,
    serverId: r.serverId,
    serverName: serverMap.get(r.serverId) ?? null,
    createTime: r.createTime
  }))
  return c.json(ok(dto))
})

roleRoutes.post('/', zValidator('json', createRoleReqSchema), async (c) => {
  const body = c.req.valid('json')
  let serverId: number
  if (body.teamId) {
    const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, body.teamId))
    if (!team) throw new ApiError(404, '号组不存在')
    serverId = team.serverId
  } else {
    serverId = body.serverId
  }
  const [server] = await db.select().from(gameServers).where(eq(gameServers.id, serverId))
  if (!server) throw new ApiError(404, '服务器不存在')
  const [row] = await db
    .insert(gameRoles)
    .values({
      teamId: body.teamId ?? null,
      serverId,
      name: body.name,
      level: body.level,
      sect: body.sect,
      createTime: nowStr()
    })
    .returning()
  return c.json(ok({ id: row.id }))
})

roleRoutes.put('/:id', zValidator('json', updateRoleReqSchema), async (c) => {
  const id = Number(c.req.param('id'))
  const body = c.req.valid('json')
  const [role] = await db.select().from(gameRoles).where(eq(gameRoles.id, id))
  if (!role) throw new ApiError(404, '角色不存在')

  let serverId: number | undefined
  if (body.teamId !== undefined) {
    if (body.teamId) {
      const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, body.teamId))
      if (!team) throw new ApiError(404, '号组不存在')
      serverId = team.serverId
    } else if (body.serverId === undefined) {
      throw new ApiError(400, '请选择服务器')
    }
  }
  if (serverId === undefined && body.serverId !== undefined) {
    const [server] = await db.select().from(gameServers).where(eq(gameServers.id, body.serverId))
    if (!server) throw new ApiError(404, '服务器不存在')
    serverId = body.serverId
  }

  await db
    .update(gameRoles)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.level !== undefined ? { level: body.level } : {}),
      ...(body.sect !== undefined ? { sect: body.sect } : {}),
      ...(body.teamId !== undefined ? { teamId: body.teamId ?? null } : {}),
      ...(serverId !== undefined ? { serverId } : {})
    })
    .where(eq(gameRoles.id, id))
  return c.json(ok(null))
})

/** 有历史记录时软删除，保留记录归属 */
roleRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [role] = await db.select().from(gameRoles).where(eq(gameRoles.id, id))
  if (!role) throw new ApiError(404, '角色不存在')
  const [used] = await db.select().from(mileageRecords).where(eq(mileageRecords.roleId, id)).limit(1)
  if (used) await db.update(gameRoles).set({ deleted: true, teamId: null }).where(eq(gameRoles.id, id))
  else await db.delete(gameRoles).where(eq(gameRoles.id, id))
  return c.json(ok(null))
})

roleRoutes.post(
  '/:id/team',
  zValidator('json', z.object({ teamId: z.number().int().positive().nullable() })),
  async (c) => {
    const id = Number(c.req.param('id'))
    const { teamId } = c.req.valid('json')
    const [role] = await db.select().from(gameRoles).where(eq(gameRoles.id, id))
    if (!role) throw new ApiError(404, '角色不存在')
    if (teamId) {
      const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, teamId))
      if (!team) throw new ApiError(404, '号组不存在')
      await db.update(gameRoles).set({ teamId, serverId: team.serverId }).where(eq(gameRoles.id, id))
    } else {
      await db.update(gameRoles).set({ teamId: null }).where(eq(gameRoles.id, id))
    }
    return c.json(ok(null))
  }
)

/** 批量建角色（向导第 2 步用：一次提交整个号组的角色） */
roleRoutes.post(
  '/batch',
  zValidator(
    'json',
    z.object({
      teamId: z.number().int().positive(),
      roles: z.array(z.object({ name: z.string().trim().min(1).max(50), sect: z.string().trim().max(50).default(''), level: z.number().int().min(0).max(200).default(0) })).min(1).max(20)
    })
  ),
  async (c) => {
    const { teamId, roles } = c.req.valid('json')
    const [team] = await db.select().from(gameTeams).where(eq(gameTeams.id, teamId))
    if (!team) throw new ApiError(404, '号组不存在')
    const now = nowStr()
    await db.insert(gameRoles).values(
      roles.map((r) => ({
        teamId,
        serverId: team.serverId,
        name: r.name,
        level: r.level,
        sect: r.sect,
        createTime: now
      }))
    )
    return c.json(ok(null))
  }
)
