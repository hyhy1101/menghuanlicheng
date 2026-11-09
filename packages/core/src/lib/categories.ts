import { db } from '../db/current.js'
import { itemCategories } from '../db/schema.js'

let cache: Map<number, string> | null = null

export async function loadCategoryMap(): Promise<Map<number, string>> {
  if (cache) return cache
  const rows = await db.select().from(itemCategories)
  cache = new Map(rows.map((r) => [r.id, r.code]))
  return cache
}

export async function categoryCodeOf(id: number): Promise<string> {
  const map = await loadCategoryMap()
  return map.get(id) ?? 'OTHER'
}

export async function categoryIdOf(code: string): Promise<number | undefined> {
  const map = await loadCategoryMap()
  for (const [id, c] of map) if (c === code) return id
  return undefined
}

export function invalidateCategoryCache(): void {
  cache = null
}
