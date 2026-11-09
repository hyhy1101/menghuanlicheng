import { http } from './http'
import type {
  GameItemDTO,
  GameSourceDTO,
  ItemPriceDTO,
  MileageSessionDTO,
  TotalsDTO
} from '@lc/shared'

export interface DetailAddInput {
  itemId?: number
  itemName?: string
  /** null = 明确不归属任何活动（损耗）；不传 = 归到会话当前活动 */
  sourceId?: number | null
  quantity?: number
  unitPrice?: number
  direction?: 'INCOME' | 'COST'
  remark?: string
}

/** 主进程各接口的返回体（与 packages/core 的路由一一对应） */
export interface SessionResult {
  session: MileageSessionDTO
}
export interface SessionDetailResult {
  detail: MileageSessionDTO['details'][number]
  totals: TotalsDTO
}
export interface TotalsResult {
  totals: TotalsDTO
}
export interface EndSessionResult {
  recordId: number
  summary: {
    durationMinutes: number
    totalIncome: number
    netIncome: number
    efficiency: number
    netEfficiency: number
  }
  shareText: string
}

export const sessionApi = {
  start: (body: { serverId?: number; teamId?: number; roleId?: number }) =>
    http.post<SessionResult>('/mileage-sessions', body),
  active: () => http.get<{ sessions: MileageSessionDTO[] }>('/mileage-sessions/active'),
  addDetail: (sessionId: number, body: DetailAddInput) =>
    http.post<SessionDetailResult>(`/mileage-sessions/${sessionId}/details`, body),
  updateDetail: (sessionId: number, detailId: number, body: Partial<DetailAddInput>) =>
    http.put<SessionDetailResult>(`/mileage-sessions/${sessionId}/details/${detailId}`, body),
  deleteDetail: (sessionId: number, detailId: number) =>
    http.delete<TotalsResult>(`/mileage-sessions/${sessionId}/details/${detailId}`),
  totalSilver: (sessionId: number, totalSilver: number) =>
    http.put<TotalsResult>(`/mileage-sessions/${sessionId}/total-silver`, { totalSilver }),
  setActivity: (sessionId: number, sourceId: number | null) =>
    http.put<SessionResult>(`/mileage-sessions/${sessionId}/activity`, { sourceId }),
  end: (sessionId: number, body: { totalSilver?: number; endTime?: string; belongDate?: string } = {}) =>
    http.post<EndSessionResult>(`/mileage-sessions/${sessionId}/end`, body),
  discard: (sessionId: number) => http.delete<null>(`/mileage-sessions/${sessionId}`)
}

/** 记录页要用的基础数据：物品、活动、物品价 */
export const basicApi = {
  allItems: () => http.get<GameItemDTO[]>('/items/all'),
  recentItems: (limit = 20) => http.get<GameItemDTO[]>('/items/recent', { params: { limit } }),
  frequentItems: (params: { days?: number; limit?: number } = {}) =>
    http.get<GameItemDTO[]>('/items/frequent', { params: { days: 30, limit: 60, ...params } }),
  sources: (params: { status?: string } = {}) =>
    http.get<GameSourceDTO[]>('/sources', { params: { status: 'ENABLED', ...params } }),
  itemPrice: (itemId: number, serverId: number) =>
    http.get<ItemPriceDTO | null>(`/items/${itemId}/price`, { params: { serverId } }),
  setPrice: (
    itemId: number,
    serverId: number,
    body: { merchantPrice?: number | null; personalPrice?: number | null; userPrice: number }
  ) => http.put<ItemPriceDTO>(`/items/${itemId}/price`, { serverId, ...body })
}

export interface SessionState {
  session: MileageSessionDTO | null
  totals: TotalsDTO
  paused: boolean
}

export function emptyTotals(): TotalsDTO {
  return {
    itemSum: 0,
    totalSilver: 0,
    totalIncome: 0,
    cardCost: 0,
    cardPrice: 0,
    lossTotal: 0,
    netIncome: 0,
    netEfficiency: 0
  }
}

export type { GameItemDTO, GameSourceDTO, ItemPriceDTO }
