import { http } from './http'
import type {
  DailySummaryDTO,
  GameRoleDTO,
  GameTeamDTO,
  IncomeTrendPoint,
  ItemAcquisitionItem,
  SourceRankingItem,
  TeamCompareDTO
} from '@lc/shared'

export const statisticsApi = {
  incomeTrend: (cycleType: 'WEEK' | 'MONTH' | 'YEAR', date: string) =>
    http.get<IncomeTrendPoint[]>('/statistics/income-trend', { params: { cycleType, date } }),
  dailySummary: (date: string) =>
    http.get<DailySummaryDTO>('/statistics/daily-summary', { params: { date } }),
  sourceRanking: (rangeType = 'THIS_WEEK', limit = 20) =>
    http.get<SourceRankingItem[]>('/statistics/source-ranking', { params: { rangeType, limit } }),
  itemAcquisition: (rangeType = 'THIS_MONTH', limit = 15) =>
    http.get<ItemAcquisitionItem[]>('/statistics/item-acquisition', { params: { rangeType, limit } })
}

export const teamsApi = {
  list: () => http.get<GameTeamDTO[]>('/teams'),
  compare: (rangeType = 'THIS_WEEK') =>
    http.get<TeamCompareDTO[]>('/teams/compare', { params: { rangeType } }),
  detail: (id: number) => http.get<{ team: GameTeamDTO; roles: GameRoleDTO[] }>(`/teams/${id}`),
  create: (name: string, serverId: number, roleIds?: number[]) =>
    http.post<GameTeamDTO>('/teams', { name, serverId, roleIds }),
  update: (id: number, body: Record<string, unknown>) =>
    http.put<GameTeamDTO>(`/teams/${id}`, body),
  remove: (id: number) => http.delete(`/teams/${id}`),
  roles: () => http.get<GameRoleDTO[]>('/roles'),
  createRole: (body: { name: string; level: number; sect: string; teamId?: number; serverId?: number }) =>
    http.post<GameRoleDTO>('/roles', body),
  updateRole: (id: number, body: Record<string, unknown>) =>
    http.put<GameRoleDTO>(`/roles/${id}`, body),
  removeRole: (id: number) => http.delete(`/roles/${id}`),
  batchRoles: (body: { teamId: number; roles: Array<{ name: string; sect: string; level: number }> }) =>
    http.post('/roles/batch', body)
}

export type {
  DailySummaryDTO,
  TeamCompareDTO,
  IncomeTrendPoint,
  ItemAcquisitionItem,
  SourceRankingItem
}
