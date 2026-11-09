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

export const recordsApi = {
  list: (params: RecordListParams = {}) =>
    http.get<RecordListResult>('/mileage-records', { params: { ...params } }),
  detail: (id: number) => http.get<MileageRecordDTO>(`/mileage-records/${id}`)
}
