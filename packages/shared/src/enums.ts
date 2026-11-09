/** 基础枚举（离线版） */

export const SOURCE_TYPES = ['DUNGEON', 'GUILD', 'ACTIVITY', 'DAILY', 'WEEKEND', 'CUSTOM'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const ITEM_CATEGORIES = ['EQUIP', 'BEAST_SKILL', 'FIVE_TREASURE', 'GEM', 'OTHER', 'WEAPON'] as const
export type ItemCategory = (typeof ITEM_CATEGORIES)[number]

export const SERVER_STATUSES = ['OPEN', 'NEW', 'CLOSED'] as const
export type ServerStatus = (typeof SERVER_STATUSES)[number]

export const RECORD_STATUSES = ['ACTIVE', 'FINISHED', 'DISCARDED'] as const
export type RecordStatus = (typeof RECORD_STATUSES)[number]

export const COST_TYPES = ['CARD', 'LOSS'] as const
export type CostType = (typeof COST_TYPES)[number]

export const DETAIL_DIRECTIONS = ['INCOME', 'COST'] as const
export type DetailDirection = (typeof DETAIL_DIRECTIONS)[number]

export const CYCLE_TYPES = ['WEEK', 'MONTH', 'YEAR'] as const
export type CycleType = (typeof CYCLE_TYPES)[number]

export const TREND_SIGNALS = ['UP', 'DOWN', 'STABLE'] as const
export type TrendSignal = (typeof TREND_SIGNALS)[number]

export const RANGE_TYPES = ['THIS_WEEK', 'THIS_MONTH', 'ALL'] as const
export type RangeType = (typeof RANGE_TYPES)[number]

export const ITEM_STATUSES = ['ENABLED', 'DISABLED'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

export const ACTIVITY_RULE_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY_NTH'] as const
export type ActivityRuleType = (typeof ACTIVITY_RULE_TYPES)[number]

/** 业务常量 */
export const DEFAULT_CARD_PRICE_MIN = 1000
export const DEFAULT_CARD_PRICE_MAX = 100000
export const DEFAULT_CARD_PRICE = 12800
export const POINT_CARD_HOURS = 6 // 点卡：6点/小时
export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024
export const BACKUP_KEEP = 7
