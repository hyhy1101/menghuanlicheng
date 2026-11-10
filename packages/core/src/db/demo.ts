/**
 * 示例数据初始化（设置页「一键初始化」）。
 *
 * 目的：新装或是想看看报表长什么样时，一次点出「服务器 / 号组 / 角色 / 里程记录」
 * 一整套示例数据。数据全部是编的，名字、收益都是假的，别拿它对账。
 *
 * 两条规矩：
 * - 只在业务表全空、或用户明确选择「清空后重建」时才写。已有真实数据时宁可报错，
 *   也不往里面掺示例记录。
 * - 物品、活动（玩法）、内置分类不动：它们是程序自带的种子数据，不属于用户数据。
 */
import { eq, sql } from 'drizzle-orm'
import type { DemoInitResultDTO } from '@lc/shared'
import { calcItemValue, calcTotals } from '../lib/calc.js'
import { refreshDailyStats } from '../lib/stats.js'
import { addDays, formatDateTime, nowStr, todayStr } from '../lib/time.js'
import { ApiError } from '../middleware/error.js'
import { db } from './current.js'
import {
  costRecords,
  gameItems,
  gameRoles,
  gameServers,
  gameSources,
  gameTeams,
  incomeDailyStats,
  itemPrices,
  mileageRecordDetails,
  mileageRecords,
  profile,
  settings
} from './schema.js'

const DEMO_SERVERS = [
  { name: '珍宝阁', region: '电信', cardPrice: 12800, remark: '示例数据，可删除' },
  { name: '紫禁城', region: '网通', cardPrice: 13200, remark: '示例数据，可删除' }
]

const DEMO_TEAMS = [
  { name: '珍宝阁·五开一队', server: 0 },
  { name: '珍宝阁·五开二队', server: 0 },
  { name: '紫禁城·五开队', server: 1 }
]

const DEMO_ROLES: { name: string; level: number; sect: string }[][] = [
  [
    { name: '一梦长安', level: 109, sect: '大唐官府' },
    { name: '白衣渡江', level: 109, sect: '化生寺' },
    { name: '月下独酌', level: 109, sect: '方寸山' },
    { name: '南山采菊', level: 109, sect: '普陀山' },
    { name: '沧海明月', level: 109, sect: '龙宫' }
  ],
  [
    { name: '北冥有鱼', level: 129, sect: '狮驼岭' },
    { name: '云深不知', level: 129, sect: '魔王寨' },
    { name: '青梅煮酒', level: 129, sect: '盘丝洞' },
    { name: '剑指苍穹', level: 129, sect: '天宫' },
    { name: '桃之夭夭', level: 129, sect: '五庄观' }
  ],
  [
    { name: '长安故人', level: 175, sect: '大唐官府' },
    { name: '听雨轩主', level: 175, sect: '龙宫' },
    { name: '岁岁平安', level: 175, sect: '普陀山' },
    { name: '山海不辞', level: 175, sect: '女儿村' },
    { name: '星河入梦', level: 175, sect: '阴曹地府' }
  ]
]

/** 每档时长对应的一局银两（两）。按 12000 两/分钟估，五开一小时两百万上下 */
const DURATIONS = [120, 150, 180, 210]
const SILVER_PER_MINUTE = 12000

/** 兜底价格档位：拿不到内置物品时按名字现填，价格用这几档 */
const ITEM_PRICE_TIERS = [900_000, 260_000, 120_000, 80_000, 45_000, 150_000]

const pad = (n: number) => String(n).padStart(2, '0')

interface Pick {
  itemId: number | null
  itemName: string
  quantity: number
  unitPrice: number
}

function startAt(date: string, hour: number, minute: number): string {
  return `${date} ${pad(hour)}:${pad(minute)}:00`
}

function plusMinutes(time: string, minutes: number): string {
  return formatDateTime(new Date(new Date(time.replace(' ', 'T')).getTime() + minutes * 60_000))
}

export async function initDemoData(reset: boolean): Promise<DemoInitResultDTO> {
  const result: DemoInitResultDTO = { reset, servers: 0, teams: 0, roles: 0, records: 0 }

  await db.transaction(async (tx) => {
    const [srvCnt] = await tx.select({ n: sql<number>`count(*)` }).from(gameServers)
    const [teamCnt] = await tx.select({ n: sql<number>`count(*)` }).from(gameTeams)
    const [roleCnt] = await tx.select({ n: sql<number>`count(*)` }).from(gameRoles)
    const [recCnt] = await tx.select({ n: sql<number>`count(*)` }).from(mileageRecords)
    const hasData =
      Number(srvCnt?.n ?? 0) + Number(teamCnt?.n ?? 0) + Number(roleCnt?.n ?? 0) + Number(recCnt?.n ?? 0) > 0

    if (hasData && !reset) {
      throw new ApiError(409, '本地已有服务器 / 号组 / 角色 / 记录。要重新初始化，请勾选「清空现有数据」')
    }

    if (reset) {
      // 先删子表再删父表；物品、活动属于内置种子数据，保留
      await tx.delete(mileageRecordDetails)
      await tx.delete(costRecords)
      await tx.delete(mileageRecords)
      await tx.delete(incomeDailyStats)
      await tx.delete(itemPrices)
      await tx.delete(gameRoles)
      await tx.delete(gameTeams)
      await tx.delete(gameServers)
    }

    const now = nowStr()

    /* ---------- 服务器 ---------- */
    const servers = await tx
      .insert(gameServers)
      .values(DEMO_SERVERS.map((s) => ({ ...s, status: 'OPEN' as const, createTime: now })))
      .returning()
    result.servers = servers.length

    /* ---------- 号组 ---------- */
    const teams = await tx
      .insert(gameTeams)
      .values(DEMO_TEAMS.map((t) => ({ name: t.name, serverId: servers[t.server].id, createTime: now })))
      .returning()
    result.teams = teams.length

    /* ---------- 角色 ---------- */
    const roleValues = DEMO_ROLES.flatMap((roles, teamIdx) =>
      roles.map((r) => ({
        teamId: teams[teamIdx].id,
        serverId: teams[teamIdx].serverId,
        name: r.name,
        level: r.level,
        sect: r.sect,
        deleted: false,
        createTime: now
      }))
    )
    await tx.insert(gameRoles).values(roleValues)
    result.roles = roleValues.length

    /* ---------- 记录 ---------- */
    // 内置物品按「固定价格」的优先，拿它来当示例收获；一条都没有就退回纯文本物品
    const itemRows = await tx
      .select()
      .from(gameItems)
      .where(eq(gameItems.status, 'ENABLED'))
      .limit(6)
    // 活动来源用于明细的「出处」，有就用，没有留空
    const sourceRows = await tx.select().from(gameSources).limit(4)

    const today = todayStr()
    const roleCount = 5
    const plan: { date: string; teamIdx: number; time: string; minutes: number }[] = []

    for (let day = 0; day < 12; day++) {
      const date = addDays(today, -day)
      plan.push({ date, teamIdx: day % teams.length, time: startAt(date, 19, (day % 2) * 30), minutes: DURATIONS[day % DURATIONS.length] })
      if (day % 4 === 0) {
        // 隔几天补一场下午的短局，让日统计里偶尔出现一天两场
        plan.push({
          date,
          teamIdx: (day + 1) % teams.length,
          time: startAt(date, 14, 0),
          minutes: 90
        })
      }
    }

    const dates = new Set<string>()

    for (let i = 0; i < plan.length; i++) {
      const p = plan[i]
      const team = teams[p.teamIdx]
      const server = servers.find((s) => s.id === team.serverId)!
      const totalSilver = p.minutes * SILVER_PER_MINUTE

      const picks: Pick[] = []
      const pickCount = 1 + (i % 3)
      for (let k = 0; k < pickCount; k++) {
        const item = itemRows.length ? itemRows[(i + k) % itemRows.length] : null
        const unitPrice = ITEM_PRICE_TIERS[(i + k) % ITEM_PRICE_TIERS.length]
        picks.push({
          itemId: item?.id ?? null,
          itemName: item?.name ?? '杂项收获',
          quantity: 1 + ((i + k) % 2),
          unitPrice
        })
      }

      const totals = calcTotals({
        totalSilver,
        details: picks.map((x) => ({ quantity: x.quantity, unitPrice: x.unitPrice, direction: 'INCOME' as const })),
        durationMinutes: p.minutes,
        roleCount,
        cardPrice: server.cardPrice,
        lossCosts: 0
      })

      const endTime = plusMinutes(p.time, p.minutes)
      const [record] = await tx
        .insert(mileageRecords)
        .values({
          teamId: team.id,
          roleId: null,
          serverId: server.id,
          startTime: p.time,
          endTime,
          durationMinutes: p.minutes,
          roleCount,
          currentSourceId: null,
          totalSilver,
          itemSum: totals.itemSum,
          totalIncome: totals.totalIncome,
          cardPrice: server.cardPrice,
          cardCost: totals.cardCost,
          lossTotal: totals.lossTotal,
          netIncome: totals.netIncome,
          efficiency: totals.efficiency,
          netEfficiency: totals.netEfficiency,
          belongDate: p.date,
          status: 'FINISHED',
          createTime: now
        })
        .returning({ id: mileageRecords.id })

      await tx.insert(mileageRecordDetails).values(
        picks.map((x, k) => ({
          recordId: record.id,
          itemId: x.itemId,
          itemName: x.itemName,
          sourceId: sourceRows.length ? sourceRows[(i + k) % sourceRows.length].id : null,
          quantity: x.quantity,
          unitPrice: x.unitPrice,
          itemValue: calcItemValue(x.quantity, x.unitPrice, 'INCOME'),
          direction: 'INCOME' as const,
          remark: null,
          createTime: plusMinutes(p.time, 10 * (k + 1))
        }))
      )

      await tx.insert(costRecords).values({
        recordId: record.id,
        costType: 'CARD',
        itemId: null,
        name: '点卡成本',
        amount: totals.cardCost,
        remark: `${roleCount} 角色 × ${p.minutes} 分钟 × 6 点/小时`,
        createTime: endTime
      })

      dates.add(p.date)
      result.records++
    }

    for (const d of dates) await refreshDailyStats(tx, d)

    /* ---------- 档案与默认项 ---------- */
    const defaultServerId = servers[0].id
    const defaultTeamId = teams[0].id

    const [prof] = await tx.select().from(profile).where(eq(profile.id, 1))
    if (prof) {
      await tx.update(profile).set({ nickname: '梦幻玩家' }).where(eq(profile.id, 1))
    } else {
      await tx.insert(profile).values({ id: 1, nickname: '梦幻玩家', avatar: null, createTime: now })
    }

    const [set] = await tx.select().from(settings).where(eq(settings.id, 1))
    if (set) {
      await tx
        .update(settings)
        .set({ defaultServerId, defaultTeamId, onboardingDone: true })
        .where(eq(settings.id, 1))
    } else {
      await tx
        .insert(settings)
        .values({ id: 1, defaultServerId, defaultTeamId, onboardingDone: true })
    }
  })

  return result
}
