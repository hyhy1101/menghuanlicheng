import { and, asc, eq, inArray } from 'drizzle-orm'
import type { GameItemDTO, ItemPriceDTO } from '@lc/shared'
import type { Db } from '../db/client.js'
import { gameItems, itemCategories, itemPrices } from '../db/schema.js'
import { nowStr } from './time.js'

/**
 * 物品价格：只对「固定价格物品」按 (物品 × 服务器) 维护三档价。
 * 三者语义（由高到低）：用户录入价 > 玩家收购价 > 商人玩家收购价。
 * 记账时默认带出用户录入价；商人/个人收购价仅作参考，可空。
 */
export async function getItemPrice(
  db: Db,
  itemId: number,
  serverId: number
): Promise<ItemPriceDTO | null> {
  const [row] = await db
    .select()
    .from(itemPrices)
    .where(and(eq(itemPrices.itemId, itemId), eq(itemPrices.serverId, serverId)))
  if (!row) return null
  return toItemPriceDTO(row)
}

export function toItemPriceDTO(row: typeof itemPrices.$inferSelect): ItemPriceDTO {
  return {
    itemId: row.itemId,
    serverId: row.serverId,
    merchantPrice: row.merchantPrice,
    personalPrice: row.personalPrice,
    userPrice: row.userPrice,
    updateTime: row.updateTime
  }
}

export async function upsertItemPrice(
  db: Db,
  input: {
    itemId: number
    serverId: number
    merchantPrice?: number | null
    personalPrice?: number | null
    userPrice: number
  }
): Promise<ItemPriceDTO> {
  const now = nowStr()
  const [row] = await db
    .insert(itemPrices)
    .values({
      itemId: input.itemId,
      serverId: input.serverId,
      merchantPrice: input.merchantPrice ?? null,
      personalPrice: input.personalPrice ?? null,
      userPrice: input.userPrice,
      updateTime: now
    })
    .onConflictDoUpdate({
      target: [itemPrices.itemId, itemPrices.serverId],
      set: {
        merchantPrice: input.merchantPrice ?? null,
        personalPrice: input.personalPrice ?? null,
        userPrice: input.userPrice,
        updateTime: now
      }
    })
    .returning()
  return toItemPriceDTO(row)
}

export async function listPricesOfServer(db: Db, serverId: number): Promise<ItemPriceDTO[]> {
  const rows = await db.select().from(itemPrices).where(eq(itemPrices.serverId, serverId))
  return rows.map(toItemPriceDTO)
}

/** 物品 DTO 需要分类 code，统一在这里拼，避免各处重复 */
export async function loadItemDTOs(db: Db, ids?: number[]): Promise<GameItemDTO[]> {
  const rows =
    ids && ids.length > 0
      ? await db.select().from(gameItems).where(inArray(gameItems.id, ids))
      : await db.select().from(gameItems).orderBy(asc(gameItems.pinyin), asc(gameItems.id))
  const cats = await db.select().from(itemCategories).orderBy(asc(itemCategories.sortOrder))
  const catById = new Map(cats.map((c) => [c.id, c]))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    pinyin: r.pinyin,
    category: (catById.get(r.categoryId)?.code ?? 'OTHER') as GameItemDTO['category'],
    level: r.level,
    iconUrl: r.iconUrl,
    isCommon: r.isCommon,
    isFixedPrice: r.isFixedPrice,
    status: r.status,
    createTime: r.createTime
  }))
}
