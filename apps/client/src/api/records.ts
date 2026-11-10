import { http } from './http'
import type { MileageRecordDTO } from '@lc/shared'

export interface RecordListParams {
  page?: number
  pageSize?: number
  belongDate?: string
  startDate?: string
  endDate?: string
  keyword?: string
}

export interface RecordListResult {
  list: MileageRecordDTO[]
  total: number
  page: number
  pageSize: number
}

export interface ClearRecordsParams {
  /** true = 清空全部已结算记录，忽略日期和关键字 */
  all?: boolean
  startDate?: string
  endDate?: string
  keyword?: string
}

export const recordsApi = {
  list: (params: RecordListParams = {}) =>
    http.get<RecordListResult>('/mileage-records', { params: { ...params } }),
  detail: (id: number) => http.get<MileageRecordDTO>(`/mileage-records/${id}`),
  /** 批量清理已结算记录，返回实际删除条数 */
  clear: ({ all, ...rest }: ClearRecordsParams) =>
    http.delete<{ deleted: number }>('/mileage-records', {
      params: all ? { ...rest, all: 'true' } : { ...rest }
    })
}
