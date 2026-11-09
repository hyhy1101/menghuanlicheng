import type {
  CostType,
  DetailDirection,
  ItemCategory,
  ItemStatus,
  RecordStatus,
  ServerStatus,
  SourceType,
  TrendSignal
} from './enums.js'

/** 通用时间字符串 */
export type DateTime = string // 'YYYY-MM-DD HH:mm:ss'
export type DateStr = string // 'YYYY-MM-DD'

/* ---------- 本地档案 ---------- */
export interface ProfileDTO {
  nickname: string
  avatar?: string | null
  createTime: DateTime
}

/* ---------- 服务器 ---------- */
export interface GameServerDTO {
  id: number
  name: string
  region: string
  status: ServerStatus
  /** 该服点卡单价（两/点） */
  cardPrice: number
  remark?: string | null
  createTime: DateTime
}

/* ---------- 物品 ---------- */
export interface GameItemDTO {
  id: number
  name: string
  pinyin: string
  category: ItemCategory
  level: string
  /** 相对资源路径：items/xxx.png（内置）或 user/xxx.png（用户上传） */
  iconUrl?: string | null
  isCommon: boolean
  /** 固定价格物品：价格按「物品 × 服务器」维护；非固定价格物品每次记账现填 */
  isFixedPrice: boolean
  status: ItemStatus
  createTime: DateTime
}

/** 物品在某服务器上的三档价格（仅固定价格物品有记录） */
export interface ItemPriceDTO {
  itemId: number
  serverId: number
  /** 商人玩家收购价（最低） */
  merchantPrice: number | null
  /** 玩家喊话收购价（中间） */
  personalPrice: number | null
  /** 用户录入价（记账默认值，必填） */
  userPrice: number | null
  updateTime: DateTime
}

/* ---------- 玩法 / 活动 ---------- */
export type ActivityRule =
  | { type: 'DAILY'; start: string; end: string }
  | { type: 'WEEKLY'; dayOfWeek: number; start: string; end: string }
  /** nth: 1~4；5 表示当月最后一个该星期几 */
  | { type: 'MONTHLY_NTH'; nth: number; dayOfWeek: number; start: string; end: string }

export interface SourceReminder {
  enabled: boolean
  /** 提前多少分钟提醒 */
  beforeMinutes: number
  /** 开始时刻是否再提醒一次 */
  atStart: boolean
}

export interface GameSourceDTO {
  id: number
  name: string
  type: SourceType
  level?: number | null
  durationDesc?: string | null
  rules: ActivityRule[]
  intro?: string | null
  reminder: SourceReminder
  status: 'ENABLED' | 'DISABLED'
  createTime: DateTime
}

/** 某天某活动的具体场次（由规则展开而来） */
export interface ActivityOccurrenceDTO {
  sourceId: number
  sourceName: string
  sourceType: SourceType
  date: DateStr
  start: DateTime
  end: DateTime
  /** 跨零点场次的结束日期可能晚一天 */
  endsNextDay: boolean
}

/* ---------- 角色 / 号组 ---------- */
export interface GameRoleDTO {
  id: number
  name: string
  level: number
  sect: string
  teamId?: number | null
  teamName?: string | null
  serverId: number
  serverName?: string | null
  createTime: DateTime
}
export interface GameTeamDTO {
  id: number
  name: string
  serverId: number
  serverName?: string | null
  roleCount: number
  todayIncome: number
  weekNetIncome: number
  netEfficiency: number
  createTime: DateTime
}

/** 号组对比（/teams/compare）：按区间聚合的净收益与效率 */
export interface TeamCompareDTO {
  teamId: number
  teamName: string
  serverId: number
  serverName?: string | null
  roleCount: number
  netIncome: number
  durationMinutes: number
  netEfficiency: number
}

/* ---------- 里程记录 ---------- */
export interface MileageDetailDTO {
  id: number
  itemId?: number | null
  itemName?: string | null
  iconUrl?: string | null
  quantity: number
  unitPrice: number
  itemValue: number // quantity × unitPrice，COST 方向为负数
  sourceId?: number | null
  source?: GameSourceDTO | null
  direction: DetailDirection
  remark?: string | null
}
export interface MileageRecordDTO {
  id: number
  teamId?: number | null
  teamName?: string | null
  roleId?: number | null
  roleName?: string | null
  serverId: number
  serverName?: string | null
  status: RecordStatus
  startTime: DateTime
  endTime: DateTime
  durationMinutes: number
  totalSilver: number
  itemSum: number
  totalIncome: number
  cardCost: number
  lossTotal: number
  netIncome: number
  efficiency: number
  netEfficiency: number
  belongDate: DateStr
  details: MileageDetailDTO[]
  costs: CostDTO[]
  createTime: DateTime
}
export interface CostDTO {
  id: number
  costType: CostType
  itemId?: number | null
  name?: string | null
  amount: number
  remark?: string | null
  createTime: DateTime
}

/** 里程会话（进行中） */
export interface MileageSessionDTO {
  id: number
  serverId: number
  serverName?: string | null
  teamId?: number | null
  teamName?: string | null
  roleId?: number | null
  roleName?: string | null
  roleCount: number
  status: RecordStatus
  startTime: DateTime
  lastActivityAt: DateTime
  totalSilver: number
  itemSum: number
  totalIncome: number
  cardCost: number
  cardPrice: number
  lossTotal: number
  netIncome: number
  netEfficiency: number
  elapsedMinutes: number
  currentSource?: { id: number; name: string } | null
  details: MileageDetailDTO[]
}

export interface TotalsDTO {
  itemSum: number
  totalSilver: number
  totalIncome: number
  cardCost: number
  cardPrice: number
  lossTotal: number
  netIncome: number
  netEfficiency: number
}

/* ---------- 用户设置 ---------- */
export interface UserSettingsDTO {
  defaultServerId?: number | null
  defaultTeamId?: number | null
  autoDateCorrect: boolean
  /** 首次向导是否已完成 */
  onboardingDone: boolean
  /** 更新检查的仓库地址，形如 owner/repo，空则不检查 */
  updateRepo: string
  /** 关闭窗口时收进托盘 */
  closeToTray: boolean
}

/* ---------- 统计 ---------- */
export interface IncomeTrendPoint {
  date: string
  totalIncome: number
  netIncome: number
  durationMinutes: number
  recordCount: number
}
export interface DailySummaryDTO {
  totalIncome: number
  netIncome: number
  durationMinutes: number
  efficiency: number
  recordCount: number
  activeSessionCount: number
}
export interface SourceRankingItem {
  sourceId: number
  sourceName: string
  sourceType: SourceType
  avgNetIncomePerHour: number
  totalNetIncome: number
  totalIncome: number
  totalDurationMinutes: number
  recordCount: number
  trend: TrendSignal
  samples: { recordId: number; netIncome: number; durationMinutes: number }[]
}
export interface ItemAcquisitionItem {
  itemId: number | null
  itemName: string
  quantity: number
  itemValue: number
  recordCount: number
}
