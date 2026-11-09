import { sql } from 'drizzle-orm'
import { invalidateCategoryCache } from '../lib/categories.js'
import { nowStr } from '../lib/time.js'
import { db } from './current.js'
import { gameItems, gameSources, itemCategories } from './schema.js'
import { SEED_ACTIVITIES } from './seed/activities.js'
import { SEED_ITEMS } from './seed/items.js'
import { SEED_SOURCES } from './seed/sources.js'

const CATEGORIES = [
  { code: 'EQUIP', name: '装备', sortOrder: 1 },
  { code: 'BEAST_SKILL', name: '兽决', sortOrder: 2 },
  { code: 'FIVE_TREASURE', name: '五宝', sortOrder: 3 },
  { code: 'GEM', name: '宝石', sortOrder: 4 },
  { code: 'OTHER', name: '其他', sortOrder: 5 },
  { code: 'WEAPON', name: '武器', sortOrder: 6 }
] as const

/**
 * 首次启动导入内置数据。
 *
 * 每类数据只在「完全没有」时导一次：老用户升级不会被重灌、也不会覆盖他改过的
 * 物品名/图标/价格。想重新灌某个分类，删掉对应表的数据重启即可。
 */
export async function seedIfEmpty(): Promise<void> {
  await seedCategories()
  await seedItems()
  await seedSources()
}

async function seedCategories(): Promise<void> {
  const rows = await db.select({ id: itemCategories.id }).from(itemCategories).limit(1)
  if (rows.length > 0) return
  await db.insert(itemCategories).values(CATEGORIES.map((c) => ({ ...c })))
  invalidateCategoryCache()
}

async function seedItems(): Promise<void> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(gameItems)
  if (Number(row?.n ?? 0) > 0) return

  const cats = await db.select().from(itemCategories)
  const idByCode = new Map(cats.map((c) => [c.code, c.id]))
  const now = nowStr()
  const values = SEED_ITEMS.filter((i) => idByCode.has(i.category)).map((i) => ({
    name: i.name,
    pinyin: i.pinyin,
    categoryId: idByCode.get(i.category)!,
    level: '',
    iconUrl: `items/${i.icon}`,
    isFixedPrice: i.fixedPrice,
    isCommon: false,
    status: 'ENABLED' as const,
    createTime: now
  }))

  // 分批插入，避开单条语句的参数上限
  for (let i = 0; i < values.length; i += 100) {
    await db.insert(gameItems).values(values.slice(i, i + 100))
  }
}

async function seedSources(): Promise<void> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(gameSources)
  if (Number(row?.n ?? 0) > 0) return

  const now = nowStr()
  const values = [...SEED_SOURCES, ...SEED_ACTIVITIES].map((s) => ({
    name: s.name,
    type: s.type,
    level: s.level ?? null,
    durationDesc: s.durationDesc ?? null,
    rules: s.rules ?? [],
    intro: s.intro ?? null,
    remindEnabled: (s.rules ?? []).length > 0,
    remindBefore: 10,
    remindAtStart: true,
    status: 'ENABLED' as const,
    createTime: now
  }))
  if (values.length) await db.insert(gameSources).values(values)
}
