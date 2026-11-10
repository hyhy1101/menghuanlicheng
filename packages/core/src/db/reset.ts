/**
 * 一键初始化（设置页「清空并初始化」）：把本地数据清空，回到刚装好的样子。
 *
 * 清掉的是用户自己录入的东西：服务器（含点卡单价）、号组、角色、里程记录与明细、
 * 成本、每日统计、物品 × 服务器价格；档案（昵称 / 头像）与默认服务器、默认号组一并复位。
 *
 * 不动的是程序自带的数据与偏好：
 * - 物品目录、活动（玩法）规则是内置种子数据，清掉还得重新灌一遍，且不属于用户录入；
 * - 跨零点修正、关闭窗口收托盘、开机自启是使用偏好，和业务数据无关，重来一遍只会招人烦。
 *
 * onboardingDone 保持原值：初始化是「清干净」，不是「重装」，不该把人丢回首次向导。
 */
import { rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import type { DataResetResultDTO } from '@lc/shared'
import { getPaths } from '../runtime.js'
import { nowStr } from '../lib/time.js'
import { db } from './current.js'
import {
  costRecords,
  gameRoles,
  gameServers,
  gameTeams,
  incomeDailyStats,
  itemPrices,
  mileageRecordDetails,
  mileageRecords,
  profile,
  settings
} from './schema.js'

/**
 * 删掉档案头像对应的文件。
 *
 * 库里只留相对路径（user/avatars/xxx.png），文件在 userData/images 下。
 * 删不掉不影响结果 —— 库里已经不再引用，最多留个孤儿文件，所以静默失败。
 */
function removeAvatarFile(rel: string | null): void {
  if (!rel || !rel.startsWith('user/')) return
  const imagesDir = getPaths().images
  const base = resolve(imagesDir)
  const full = resolve(join(imagesDir, rel.slice('user/'.length)))
  // 防路径穿越：相对路径只能落在 images 目录内
  if (full !== base && !full.startsWith(base + sep)) return
  try {
    rmSync(full, { force: true })
  } catch {
    /* 忽略 */
  }
}

export async function resetAllData(): Promise<DataResetResultDTO> {
  let avatarRel: string | null = null
  const result: DataResetResultDTO = { servers: 0, teams: 0, roles: 0, records: 0, itemPrices: 0 }

  await db.transaction(async (tx) => {
    // 先数一遍，返回给界面告诉用户清掉了多少
    const [srv] = await tx.select({ n: sql<number>`count(*)` }).from(gameServers)
    const [team] = await tx.select({ n: sql<number>`count(*)` }).from(gameTeams)
    const [role] = await tx.select({ n: sql<number>`count(*)` }).from(gameRoles)
    const [rec] = await tx.select({ n: sql<number>`count(*)` }).from(mileageRecords)
    const [price] = await tx.select({ n: sql<number>`count(*)` }).from(itemPrices)
    result.servers = Number(srv?.n ?? 0)
    result.teams = Number(team?.n ?? 0)
    result.roles = Number(role?.n ?? 0)
    result.records = Number(rec?.n ?? 0)
    result.itemPrices = Number(price?.n ?? 0)

    // 先删子表再删父表：明细 → 成本 → 记录 → 日统计 → 价格 → 角色 → 号组 → 服务器
    await tx.delete(mileageRecordDetails)
    await tx.delete(costRecords)
    await tx.delete(mileageRecords)
    await tx.delete(incomeDailyStats)
    await tx.delete(itemPrices)
    await tx.delete(gameRoles)
    await tx.delete(gameTeams)
    await tx.delete(gameServers)

    /* ---------- 档案复位 ---------- */
    const [prof] = await tx.select().from(profile).where(eq(profile.id, 1))
    avatarRel = prof?.avatar ?? null
    if (prof) {
      await tx.update(profile).set({ nickname: '玩家', avatar: null }).where(eq(profile.id, 1))
    } else {
      await tx.insert(profile).values({ id: 1, nickname: '玩家', avatar: null, createTime: nowStr() })
    }

    /* ---------- 默认项复位 ---------- */
    const [set] = await tx.select().from(settings).where(eq(settings.id, 1))
    if (set) {
      await tx
        .update(settings)
        .set({ defaultServerId: null, defaultTeamId: null })
        .where(eq(settings.id, 1))
    } else {
      await tx.insert(settings).values({ id: 1, onboardingDone: true })
    }
  })

  // 库已提交，再删文件：文件删失败不该把数据回滚
  removeAvatarFile(avatarRel)

  return result
}
