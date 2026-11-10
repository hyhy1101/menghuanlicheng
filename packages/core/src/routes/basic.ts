import { Hono } from 'hono'
import { zValidator } from '../lib/zod-validate.js'
import { and, eq, gte, inArray, isNotNull, like, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  createItemReqSchema,
  createServerReqSchema,
  createSourceReqSchema,
  updateItemReqSchema,
  updateServerReqSchema,
  updateSettingsReqSchema,
  updateSourceReqSchema,
  upsertItemPriceReqSchema,
  type GameItemDTO,
  type GameServerDTO,
  type GameSourceDTO,
  type ItemPriceDTO,
  type ProfileDTO,
  type UserSettingsDTO
} from '@lc/shared'
import { db } from '../db/current.js'
import { resetAllData } from '../db/reset.js'
import {
  gameItems,
  gameServers,
  gameSources,
  gameTeams,
  itemCategories,
  itemPrices,
  mileageRecordDetails,
  mileageRecords,
  profile,
  settings
} from '../db/schema.js'
import { ApiError } from '../middleware/error.js'
import { categoryIdOf } from '../lib/categories.js'
import { occurrencesOf } from '../lib/activity.js'
import { addDays, nowStr, todayStr } from '../lib/time.js'
import { saveDataUrlImage } from '../lib/images.js'
import { toItemPriceDTO, upsertItemPrice } from '../lib/price.js'

export const basicRoutes = new Hono()

const ok = <T>(data: T) => ({ code: 200, msg: 'success', data })

/* ================= 服务器 ================= */

function toServerDTO(r: typeof gameServers.$inferSelect): GameServerDTO {
  return {
    id: r.id,
    name: r.name,
    region: r.region,
    status: r.status,
    cardPrice: r.cardPrice,
    remark: r.remark,
    createTime: r.createTime
  }
}

basicRoutes.get(
  '/servers',
  zValidator(
    'query',
    z.object({
      keyword: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(200)
    })
  ),
  async (c) => {
    const q = c.req.valid('query')
    const where = q.keyword ? like(gameServers.name, `%${q.keyword}%`) : undefined
    const rows = await db.select().from(gameServers).where(where).orderBy(gameServers.id)
    const list = rows.map(toServerDTO)
    return c.json(ok({ list, total: list.length, page: q.page, pageSize: q.pageSize }))
  }
)

basicRoutes.post('/servers', zValidator('json', createServerReqSchema), async (c) => {
  const body = c.req.valid('json')
  const [dup] = await db.select().from(gameServers).where(eq(gameServers.name, body.name))
  if (dup) throw new ApiError(409, '同名服务器已存在')
  const [row] = await db
    .insert(gameServers)
    .values({ ...body, remark: body.remark ?? null, createTime: nowStr() })
    .returning()
  return c.json(ok(toServerDTO(row)))
})

basicRoutes.put('/servers/:id', zValidator('json', updateServerReqSchema), async (c) => {
  const id = Number(c.req.param('id'))
  const body = c.req.valid('json')
  const [exist] = await db.select().from(gameServers).where(eq(gameServers.id, id))
  if (!exist) throw new ApiError(404, '服务器不存在')
  if (body.name && body.name !== exist.name) {
    const [dup] = await db.select().from(gameServers).where(eq(gameServers.name, body.name))
    if (dup) throw new ApiError(409, '同名服务器已存在')
  }
  const [row] = await db
    .update(gameServers)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.region !== undefined ? { region: body.region } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.cardPrice !== undefined ? { cardPrice: body.cardPrice } : {}),
      ...(body.remark !== undefined ? { remark: body.remark ?? null } : {})
    })
    .where(eq(gameServers.id, id))
    .returning()
  return c.json(ok(toServerDTO(row)))
})

basicRoutes.delete('/servers/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [team] = await db.select().from(gameTeams).where(eq(gameTeams.serverId, id)).limit(1)
  if (team) throw new ApiError(422, '该服务器下还有号组，先删除号组')
  const [rec] = await db.select().from(mileageRecords).where(eq(mileageRecords.serverId, id)).limit(1)
  if (rec) throw new ApiError(422, '该服务器已有历史记录，不能删除')
  await db.delete(itemPrices).where(eq(itemPrices.serverId, id))
  await db.delete(gameServers).where(eq(gameServers.id, id))
  return c.json(ok(null))
})

/* ================= 物品 ================= */

async function categoryCodeMap(): Promise<Map<number, string>> {
  const rows = await db.select().from(itemCategories)
  return new Map(rows.map((r) => [r.id, r.code]))
}

function toItemDTO(r: typeof gameItems.$inferSelect, catCode: string): GameItemDTO {
  return {
    id: r.id,
    name: r.name,
    pinyin: r.pinyin,
    category: catCode as GameItemDTO['category'],
    level: r.level,
    iconUrl: r.iconUrl,
    isCommon: r.isCommon,
    isFixedPrice: r.isFixedPrice,
    status: r.status,
    createTime: r.createTime
  }
}

basicRoutes.get(
  '/items',
  zValidator(
    'query',
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(500).default(50),
      keyword: z.string().optional(),
      category: z.string().optional(),
      status: z.enum(['ENABLED', 'DISABLED']).optional(),
      sort: z.enum(['RECENT', 'NAME', 'PRICE']).default('NAME'),
      serverId: z.coerce.number().int().positive().optional()
    })
  ),
  async (c) => {
    const q = c.req.valid('query')
    const conds = [
      q.keyword ? or(like(gameItems.name, `%${q.keyword}%`), like(gameItems.pinyin, `${q.keyword.toLowerCase()}%`)) : undefined,
      q.status ? eq(gameItems.status, q.status) : undefined
    ].filter(Boolean)
    if (q.category) {
      const catId = await categoryIdOf(q.category)
      if (catId !== undefined) conds.push(eq(gameItems.categoryId, catId))
    }
    const where = conds.length ? and(...conds) : undefined
    const rows = await db.select().from(gameItems).where(where)
    const cats = await categoryCodeMap()

    let ordered = rows
    if (q.sort === 'RECENT') {
      const used = await db
        .select({
          itemId: mileageRecordDetails.itemId,
          last: sql<string>`max(${mileageRecordDetails.createTime})`
        })
        .from(mileageRecordDetails)
        .where(isNotNull(mileageRecordDetails.itemId))
        .groupBy(mileageRecordDetails.itemId)
      const lastMap = new Map(used.map((u) => [u.itemId as number, u.last ?? '']))
      ordered = [...rows].sort(
        (a, b) =>
          Number(b.isCommon) - Number(a.isCommon) ||
          (lastMap.get(b.id) ?? '').localeCompare(lastMap.get(a.id) ?? '') ||
          a.name.localeCompare(b.name, 'zh')
      )
    } else if (q.sort === 'PRICE' && q.serverId) {
      const priceRows = await db.select().from(itemPrices).where(eq(itemPrices.serverId, q.serverId))
      const priceMap = new Map(priceRows.map((p) => [p.itemId, p.userPrice ?? 0]))
      ordered = [...rows].sort((a, b) => (priceMap.get(b.id) ?? 0) - (priceMap.get(a.id) ?? 0))
    } else {
      ordered = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    }

    const total = ordered.length
    const page = ordered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
    return c.json(
      ok({
        list: page.map((r) => toItemDTO(r, cats.get(r.categoryId) ?? 'OTHER')),
        total,
        page: q.page,
        pageSize: q.pageSize
      })
    )
  }
)

basicRoutes.get('/items/all', async (c) => {
  const rows = await db.select().from(gameItems).where(eq(gameItems.status, 'ENABLED'))
  const cats = await categoryCodeMap()
  const list = rows
    .map((r) => toItemDTO(r, cats.get(r.categoryId) ?? 'OTHER'))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'zh'))
  return c.json(ok(list))
})

basicRoutes.get(
  '/items/recent',
  zValidator('query', z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) })),
  async (c) => {
    const limit = c.req.valid('query').limit
    const used = await db
      .select({
        itemId: mileageRecordDetails.itemId,
        last: sql<string>`max(${mileageRecordDetails.createTime})`
      })
      .from(mileageRecordDetails)
      .where(isNotNull(mileageRecordDetails.itemId))
      .groupBy(mileageRecordDetails.itemId)
      .orderBy(sql`max(${mileageRecordDetails.createTime}) desc`)
      .limit(limit)
    const ids = used.map((u) => u.itemId as number)
    if (ids.length === 0) return c.json(ok([]))
    const rows = await db.select().from(gameItems).where(inArray(gameItems.id, ids))
    const cats = await categoryCodeMap()
    const byId = new Map(rows.map((r) => [r.id, r]))
    return c.json(
      ok(ids.map((id) => byId.get(id)).filter(Boolean).map((r) => toItemDTO(r!, cats.get(r!.categoryId) ?? 'OTHER')))
    )
  }
)

basicRoutes.get(
  '/items/frequent',
  zValidator(
    'query',
    z.object({
      days: z.coerce.number().int().min(1).max(365).default(30),
      limit: z.coerce.number().int().min(1).max(200).default(60)
    })
  ),
  async (c) => {
    const { days, limit } = c.req.valid('query')
    const since = addDays(todayStr(), -(days - 1))
    const agg = await db
      .select({
        itemId: mileageRecordDetails.itemId,
        total: sql<number>`sum(${mileageRecordDetails.quantity})`
      })
      .from(mileageRecordDetails)
      .innerJoin(mileageRecords, eq(mileageRecordDetails.recordId, mileageRecords.id))
      .where(
        and(
          eq(mileageRecords.status, 'FINISHED'),
          gte(mileageRecords.belongDate, since),
          eq(mileageRecordDetails.direction, 'INCOME'),
          isNotNull(mileageRecordDetails.itemId)
        )
      )
      .groupBy(mileageRecordDetails.itemId)
      .orderBy(sql`sum(${mileageRecordDetails.quantity}) desc`)
      .limit(limit)
    const ids = agg.map((a) => a.itemId as number)
    if (ids.length === 0) return c.json(ok([]))
    const rows = await db.select().from(gameItems).where(and(inArray(gameItems.id, ids), eq(gameItems.status, 'ENABLED')))
    const cats = await categoryCodeMap()
    const byId = new Map(rows.map((r) => [r.id, r]))
    return c.json(
      ok(ids.map((id) => byId.get(id)).filter(Boolean).map((r) => toItemDTO(r!, cats.get(r!.categoryId) ?? 'OTHER')))
    )
  }
)

basicRoutes.post('/items', zValidator('json', createItemReqSchema), async (c) => {
  const body = c.req.valid('json')
  const catId = await categoryIdOf(body.category)
  if (catId === undefined) throw new ApiError(422, '物品分类不存在')
  const [dup] = await db.select().from(gameItems).where(eq(gameItems.name, body.name))
  if (dup) throw new ApiError(409, '同名物品已存在')
  const [row] = await db
    .insert(gameItems)
    .values({
      name: body.name,
      pinyin: body.pinyin,
      categoryId: catId,
      level: body.level,
      isFixedPrice: body.isFixedPrice,
      isCommon: body.isCommon,
      status: body.status,
      createTime: nowStr()
    })
    .returning()
  return c.json(ok(toItemDTO(row, body.category)))
})

basicRoutes.put('/items/:id', zValidator('json', updateItemReqSchema), async (c) => {
  const id = Number(c.req.param('id'))
  const body = c.req.valid('json')
  const [exist] = await db.select().from(gameItems).where(eq(gameItems.id, id))
  if (!exist) throw new ApiError(404, '物品不存在')
  const catId = body.category ? await categoryIdOf(body.category) : undefined
  if (body.category && catId === undefined) throw new ApiError(422, '物品分类不存在')
  const [row] = await db
    .update(gameItems)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.pinyin !== undefined ? { pinyin: body.pinyin } : {}),
      ...(catId !== undefined ? { categoryId: catId } : {}),
      ...(body.level !== undefined ? { level: body.level } : {}),
      ...(body.isFixedPrice !== undefined ? { isFixedPrice: body.isFixedPrice } : {}),
      ...(body.isCommon !== undefined ? { isCommon: body.isCommon } : {}),
      ...(body.status !== undefined ? { status: body.status } : {})
    })
    .where(eq(gameItems.id, id))
    .returning()
  const cats = await categoryCodeMap()
  return c.json(ok(toItemDTO(row, cats.get(row.categoryId) ?? 'OTHER')))
})

/** 删除 = 停用：历史明细里还引用着它，物理删除会让旧账显示成"未知物品" */
basicRoutes.delete('/items/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [row] = await db.select().from(gameItems).where(eq(gameItems.id, id))
  if (!row) throw new ApiError(404, '物品不存在')
  await db.update(gameItems).set({ status: 'DISABLED' }).where(eq(gameItems.id, id))
  return c.json(ok(null))
})

basicRoutes.post(
  '/items/:id/icon',
  zValidator('json', z.object({ dataUrl: z.string().min(1) })),
  async (c) => {
    const id = Number(c.req.param('id'))
    const [row] = await db.select().from(gameItems).where(eq(gameItems.id, id))
    if (!row) throw new ApiError(404, '物品不存在')
    const rel = saveDataUrlImage('items', c.req.valid('json').dataUrl)
    await db.update(gameItems).set({ iconUrl: rel }).where(eq(gameItems.id, id))
    return c.json(ok({ iconUrl: rel }))
  }
)

/* ================= 物品价格 ================= */

basicRoutes.get(
  '/items/:id/price',
  zValidator('query', z.object({ serverId: z.coerce.number().int().positive() })),
  async (c) => {
    const itemId = Number(c.req.param('id'))
    const { serverId } = c.req.valid('query')
    const [item] = await db.select().from(gameItems).where(eq(gameItems.id, itemId))
    if (!item) throw new ApiError(404, '物品不存在')
    const [price] = await db
      .select()
      .from(itemPrices)
      .where(and(eq(itemPrices.itemId, itemId), eq(itemPrices.serverId, serverId)))
    return c.json(ok(price ? toItemPriceDTO(price) : null))
  }
)

basicRoutes.put('/items/:id/price', zValidator('json', upsertItemPriceReqSchema), async (c) => {
  const itemId = Number(c.req.param('id'))
  const body = c.req.valid('json')
  const [item] = await db.select().from(gameItems).where(eq(gameItems.id, itemId))
  if (!item) throw new ApiError(404, '物品不存在')
  if (!item.isFixedPrice) throw new ApiError(422, '非固定价格物品不维护价格，记账时现填')
  const dto = await upsertItemPrice(db, { itemId, ...body })
  return c.json(ok(dto))
})

basicRoutes.get(
  '/item-prices',
  zValidator('query', z.object({ serverId: z.coerce.number().int().positive() })),
  async (c) => {
    const { serverId } = c.req.valid('query')
    const rows = await db.select().from(itemPrices).where(eq(itemPrices.serverId, serverId))
    const list: ItemPriceDTO[] = rows.map(toItemPriceDTO)
    return c.json(ok(list))
  }
)

/* ================= 玩法 / 活动 ================= */

function toSourceDTO(r: typeof gameSources.$inferSelect): GameSourceDTO {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    level: r.level,
    durationDesc: r.durationDesc,
    rules: r.rules ?? [],
    intro: r.intro,
    reminder: {
      enabled: r.remindEnabled,
      beforeMinutes: r.remindBefore,
      atStart: r.remindAtStart
    },
    status: r.status,
    createTime: r.createTime
  }
}

basicRoutes.get(
  '/sources',
  zValidator(
    'query',
    z.object({
      type: z.enum(['DUNGEON', 'GUILD', 'ACTIVITY', 'DAILY', 'WEEKEND', 'CUSTOM']).optional(),
      status: z.enum(['ENABLED', 'DISABLED']).optional()
    })
  ),
  async (c) => {
    const q = c.req.valid('query')
    const rows = await db
      .select()
      .from(gameSources)
      .where(
        and(q.type ? eq(gameSources.type, q.type) : undefined, q.status ? eq(gameSources.status, q.status) : undefined)
      )
      .orderBy(gameSources.type, gameSources.name)
    return c.json(ok(rows.map(toSourceDTO)))
  }
)

basicRoutes.post('/sources', zValidator('json', createSourceReqSchema), async (c) => {
  const body = c.req.valid('json')
  const [dup] = await db.select().from(gameSources).where(eq(gameSources.name, body.name))
  if (dup) throw new ApiError(409, '同名活动已存在')
  const [row] = await db
    .insert(gameSources)
    .values({
      name: body.name,
      type: body.type,
      level: body.level ?? null,
      durationDesc: body.durationDesc ?? null,
      rules: body.rules,
      intro: body.intro ?? null,
      remindEnabled: body.reminder.enabled,
      remindBefore: body.reminder.beforeMinutes,
      remindAtStart: body.reminder.atStart,
      ...(body.status ? { status: body.status } : {}),
      createTime: nowStr()
    })
    .returning()
  return c.json(ok(toSourceDTO(row)))
})

basicRoutes.put('/sources/:id', zValidator('json', updateSourceReqSchema), async (c) => {
  const id = Number(c.req.param('id'))
  const body = c.req.valid('json')
  const [exist] = await db.select().from(gameSources).where(eq(gameSources.id, id))
  if (!exist) throw new ApiError(404, '活动不存在')
  if (body.name && body.name !== exist.name) {
    const [dup] = await db.select().from(gameSources).where(eq(gameSources.name, body.name))
    if (dup) throw new ApiError(409, '同名活动已存在')
  }
  const [row] = await db
    .update(gameSources)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.level !== undefined ? { level: body.level ?? null } : {}),
      ...(body.durationDesc !== undefined ? { durationDesc: body.durationDesc ?? null } : {}),
      ...(body.rules !== undefined ? { rules: body.rules } : {}),
      ...(body.intro !== undefined ? { intro: body.intro ?? null } : {}),
      ...(body.reminder
        ? {
            remindEnabled: body.reminder.enabled,
            remindBefore: body.reminder.beforeMinutes,
            remindAtStart: body.reminder.atStart
          }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {})
    })
    .where(eq(gameSources.id, id))
    .returning()
  return c.json(ok(toSourceDTO(row)))
})

basicRoutes.delete('/sources/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [ref] = await db
    .select()
    .from(mileageRecordDetails)
    .where(eq(mileageRecordDetails.sourceId, id))
    .limit(1)
  if (ref) throw new ApiError(422, '该活动已有历史记录，不能删除，可改为停用')
  await db.delete(gameSources).where(eq(gameSources.id, id))
  return c.json(ok(null))
})

/** 活动场次展开：周视图与提醒都吃这个接口 */
basicRoutes.get(
  '/activities',
  zValidator(
    'query',
    z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      days: z.coerce.number().int().min(1).max(31).default(7)
    })
  ),
  async (c) => {
    const q = c.req.valid('query')
    const start = q.from ?? todayStr()
    const rows = await db.select().from(gameSources).where(eq(gameSources.status, 'ENABLED'))
    const sources = rows.map(toSourceDTO)
    const out = []
    for (let i = 0; i < q.days; i++) {
      const date = addDays(start, i)
      for (const s of sources) out.push(...occurrencesOf(s, date))
    }
    out.sort((a, b) => a.start.localeCompare(b.start))
    return c.json(ok(out))
  }
)

/* ================= 设置 / 档案 ================= */

async function ensureSettingsRow() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1))
  if (row) return row
  const [created] = await db.insert(settings).values({ id: 1 }).returning()
  return created
}

function toSettingsDTO(r: typeof settings.$inferSelect): UserSettingsDTO {
  return {
    defaultServerId: r.defaultServerId,
    defaultTeamId: r.defaultTeamId,
    autoDateCorrect: r.autoDateCorrect,
    onboardingDone: r.onboardingDone,
    updateRepo: r.updateRepo,
    closeToTray: r.closeToTray
  }
}

basicRoutes.get('/settings', async (c) => {
  const row = await ensureSettingsRow()
  return c.json(ok(toSettingsDTO(row)))
})

basicRoutes.put('/settings', zValidator('json', updateSettingsReqSchema), async (c) => {
  const body = c.req.valid('json')
  await ensureSettingsRow()
  const [row] = await db
    .update(settings)
    .set({
      ...(body.defaultServerId !== undefined ? { defaultServerId: body.defaultServerId ?? null } : {}),
      ...(body.defaultTeamId !== undefined ? { defaultTeamId: body.defaultTeamId ?? null } : {}),
      ...(body.autoDateCorrect !== undefined ? { autoDateCorrect: body.autoDateCorrect } : {}),
      ...(body.onboardingDone !== undefined ? { onboardingDone: body.onboardingDone } : {}),
      ...(body.updateRepo !== undefined ? { updateRepo: body.updateRepo } : {}),
      ...(body.closeToTray !== undefined ? { closeToTray: body.closeToTray } : {})
    })
    .where(eq(settings.id, 1))
    .returning()
  return c.json(ok(toSettingsDTO(row)))
})

async function ensureProfileRow() {
  const [row] = await db.select().from(profile).where(eq(profile.id, 1))
  if (row) return row
  const [created] = await db.insert(profile).values({ id: 1, nickname: '玩家', createTime: nowStr() }).returning()
  return created
}

function toProfileDTO(r: typeof profile.$inferSelect): ProfileDTO {
  return { nickname: r.nickname, avatar: r.avatar, createTime: r.createTime }
}

basicRoutes.get('/profile', async (c) => {
  const row = await ensureProfileRow()
  return c.json(ok(toProfileDTO(row)))
})

basicRoutes.put(
  '/profile',
  zValidator(
    'json',
    z.object({
      nickname: z.string().trim().min(1).max(30).optional(),
      avatar: z.string().max(255).nullish()
    })
  ),
  async (c) => {
    const body = c.req.valid('json')
    await ensureProfileRow()
    const [row] = await db
      .update(profile)
      .set({
        ...(body.nickname !== undefined ? { nickname: body.nickname } : {}),
        ...(body.avatar !== undefined ? { avatar: body.avatar ?? null } : {})
      })
      .where(eq(profile.id, 1))
      .returning()
    return c.json(ok(toProfileDTO(row)))
  }
)

basicRoutes.post(
  '/profile/avatar',
  zValidator('json', z.object({ dataUrl: z.string().min(1) })),
  async (c) => {
    await ensureProfileRow()
    const rel = saveDataUrlImage('avatars', c.req.valid('json').dataUrl)
    await db.update(profile).set({ avatar: rel }).where(eq(profile.id, 1))
    return c.json(ok({ avatar: rel }))
  }
)

/* ================= 一键初始化 ================= */

/**
 * 一键初始化：清空服务器 / 号组 / 角色 / 记录 / 日统计 / 物品价格，档案复位。
 *
 * 不做「重建」、也不生成示例数据 —— 清完就是空的，由用户自己重新录。
 * 物品目录与活动规则属于内置种子数据，保留。
 */
basicRoutes.post('/reset-data', async (c) => {
  const data = await resetAllData()
  return c.json(ok(data))
})
