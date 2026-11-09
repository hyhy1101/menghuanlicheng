import { http } from './http'
import type {
  ActivityOccurrenceDTO,
  GameItemDTO,
  GameServerDTO,
  GameSourceDTO,
  ItemPriceDTO,
  ProfileDTO,
  UserSettingsDTO
} from '@lc/shared'

/** 服务器 */
export const serverApi = {
  list: (keyword?: string) =>
    http.get<{ list: GameServerDTO[]; total: number }>('/servers', { params: { keyword } }),
  create: (body: { name: string; region?: string; cardPrice?: number; remark?: string }) =>
    http.post<GameServerDTO>('/servers', body),
  update: (id: number, body: Record<string, unknown>) =>
    http.put<GameServerDTO>(`/servers/${id}`, body),
  remove: (id: number) => http.delete(`/servers/${id}`)
}

/** 物品与三档价格 */
export const itemApi = {
  list: (params: {
    page?: number
    pageSize?: number
    keyword?: string
    category?: string
    status?: string
    sort?: string
    serverId?: number
  }) => http.get<{ list: GameItemDTO[]; total: number; page: number; pageSize: number }>('/items', { params }),
  all: () => http.get<GameItemDTO[]>('/items/all'),
  recent: (limit = 20) => http.get<GameItemDTO[]>('/items/recent', { params: { limit } }),
  frequent: (params: { days?: number; limit?: number } = {}) =>
    http.get<GameItemDTO[]>('/items/frequent', { params: { days: 30, limit: 60, ...params } }),
  create: (body: {
    name: string
    pinyin?: string
    category: string
    level?: string
    isFixedPrice?: boolean
    isCommon?: boolean
  }) => http.post<GameItemDTO>('/items', body),
  update: (id: number, body: Record<string, unknown>) =>
    http.put<GameItemDTO>(`/items/${id}`, body),
  disable: (id: number) => http.delete(`/items/${id}`),
  uploadIcon: (id: number, dataUrl: string) =>
    http.post<{ iconUrl: string }>(`/items/${id}/icon`, { dataUrl }),
  price: (itemId: number, serverId: number) =>
    http.get<ItemPriceDTO | null>(`/items/${itemId}/price`, { params: { serverId } }),
  setPrice: (
    itemId: number,
    serverId: number,
    body: { merchantPrice?: number | null; personalPrice?: number | null; userPrice: number }
  ) => http.put<ItemPriceDTO>(`/items/${itemId}/price`, { serverId, ...body }),
  pricesOfServer: (serverId: number) =>
    http.get<ItemPriceDTO[]>('/item-prices', { params: { serverId } })
}

/** 活动 / 玩法（含提醒规则） */
export const sourceApi = {
  list: (params: { type?: string; status?: string } = {}) =>
    http.get<GameSourceDTO[]>('/sources', { params }),
  create: (body: {
    name: string
    type: string
    level?: number
    durationDesc?: string
    rules?: unknown[]
    intro?: string
    reminder?: { enabled: boolean; beforeMinutes: number; atStart: boolean }
    status?: string
  }) => http.post<GameSourceDTO>('/sources', body),
  update: (id: number, body: Record<string, unknown>) =>
    http.put<GameSourceDTO>(`/sources/${id}`, body),
  remove: (id: number) => http.delete(`/sources/${id}`)
}

/** 活动展开后的具体场次 */
export const activityApi = {
  upcoming: (from: string, days = 7) =>
    http.get<ActivityOccurrenceDTO[]>('/activities', { params: { from, days } })
}

/** 设置 / 本地档案 */
export const settingsApi = {
  get: () => http.get<UserSettingsDTO>('/settings'),
  update: (body: Partial<UserSettingsDTO>) => http.put<UserSettingsDTO>('/settings', body)
}

export const profileApi = {
  get: () => http.get<ProfileDTO>('/profile'),
  update: (body: { nickname?: string; avatar?: string | null }) =>
    http.put<ProfileDTO>('/profile', body),
  uploadAvatar: (dataUrl: string) => http.post<{ avatar: string }>('/profile/avatar', { dataUrl })
}
