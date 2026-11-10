import { z } from 'zod'
import {
  COST_TYPES,
  CYCLE_TYPES,
  DETAIL_DIRECTIONS,
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  RANGE_TYPES,
  SERVER_STATUSES,
  SOURCE_TYPES
} from './enums.js'

/** 时间格式：YYYY-MM-DD HH:mm:ss / YYYY-MM-DD / HH:mm */
export const dateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, '时间格式应为 YYYY-MM-DD HH:mm:ss')
export const dateStrSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '时间格式应为 HH:mm')

export const idSchema = z.number().int().positive()
export const optionalId = z.number().int().positive().nullish()
/** 金额（两）为非负整数 */
export const amountSchema = z.number().int().min(0)

/* ---------- 服务器 ---------- */
export const serverStatusSchema = z.enum(SERVER_STATUSES)

export const createServerReqSchema = z.object({
  name: z.string().trim().min(1, '服务器名称不能为空').max(50),
  region: z.string().trim().max(30).default(''),
  status: serverStatusSchema.default('OPEN'),
  cardPrice: z.number().int().min(1000).max(100000).default(12800),
  remark: z.string().max(200).nullish()
})

export const updateServerReqSchema = createServerReqSchema.partial()

/* ---------- 物品 ---------- */
export const itemCategorySchema = z.enum(ITEM_CATEGORIES)
export const itemStatusSchema = z.enum(ITEM_STATUSES)

export const createItemReqSchema = z.object({
  name: z.string().trim().min(1, '物品名称不能为空').max(100),
  pinyin: z
    .string()
    .trim()
    .regex(/^[a-z]*$/, '拼音索引仅允许小写字母')
    .max(50)
    .default(''),
  category: itemCategorySchema,
  level: z.string().max(30).default(''),
  isFixedPrice: z.boolean().default(false),
  isCommon: z.boolean().default(false),
  status: itemStatusSchema.default('ENABLED')
})

export const updateItemReqSchema = createItemReqSchema.partial()

/** 三档价：商人收购价 < 个人收购价 < 用户录入价；商人/个人可空，用户录入必填 */
export const upsertItemPriceReqSchema = z
  .object({
    serverId: idSchema,
    merchantPrice: amountSchema.nullish(),
    personalPrice: amountSchema.nullish(),
    userPrice: z.number().int().min(1, '用户录入价必填且需大于 0')
  })
  .superRefine((v, ctx) => {
    const { merchantPrice: m, personalPrice: p, userPrice: u } = v
    if (m != null && p != null && m > p) {
      ctx.addIssue({ code: 'custom', message: '商人收购价不应高于个人收购价', path: ['merchantPrice'] })
    }
    if (p != null && p > u) {
      ctx.addIssue({ code: 'custom', message: '个人收购价不应高于用户录入价', path: ['personalPrice'] })
    }
  })

/* ---------- 玩法 / 活动 ---------- */
export const sourceTypeSchema = z.enum(SOURCE_TYPES)

export const activityRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('DAILY'), start: clockSchema, end: clockSchema }),
  z.object({
    type: z.literal('WEEKLY'),
    dayOfWeek: z.number().int().min(0).max(6),
    start: clockSchema,
    end: clockSchema
  }),
  z.object({
    type: z.literal('MONTHLY_NTH'),
    nth: z.number().int().min(1).max(5),
    dayOfWeek: z.number().int().min(0).max(6),
    start: clockSchema,
    end: clockSchema
  })
])

export const reminderSchema = z.object({
  enabled: z.boolean().default(true),
  beforeMinutes: z.number().int().min(0).max(180).default(10),
  atStart: z.boolean().default(true)
})

export const createSourceReqSchema = z.object({
  name: z.string().trim().min(1, '活动名称不能为空').max(100),
  type: sourceTypeSchema.default('ACTIVITY'),
  level: z.number().int().min(0).max(200).nullish(),
  durationDesc: z.string().max(50).nullish(),
  rules: z.array(activityRuleSchema).max(14).default([]),
  intro: z.string().max(500).nullish(),
  reminder: reminderSchema.default({ enabled: true, beforeMinutes: 10, atStart: true }),
  status: z.enum(['ENABLED', 'DISABLED']).optional()
})

export const updateSourceReqSchema = createSourceReqSchema.partial()

/* ---------- 号组 / 角色 ---------- */
export const createTeamReqSchema = z.object({
  name: z.string().trim().min(1).max(50),
  serverId: idSchema,
  roleIds: z.array(idSchema).max(20).optional()
})
export const updateTeamReqSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  roleIds: z.array(idSchema).max(20).optional()
})

/**
 * 角色的公共字段。serverId 在「归属号组」时由号组决定，所以这里不能要求必填，
 * 改成两者至少给一个（见 createRoleReqSchema 的 refine）。
 */
const roleBaseSchema = z.object({
  name: z.string().trim().min(1, '角色名不能为空').max(50, '角色名最长 50 个字'),
  level: z.number().int('等级需为整数').min(0, '等级不能小于 0').max(200, '等级不能大于 200').default(0),
  sect: z.string().trim().max(50, '门派最长 50 个字').default(''),
  teamId: optionalId,
  serverId: idSchema.optional()
})
export const createRoleReqSchema = roleBaseSchema.refine((v) => v.teamId != null || v.serverId != null, {
  path: ['serverId'],
  message: '请选择服务器'
})
export const updateRoleReqSchema = roleBaseSchema.partial()

/* ---------- 里程 ---------- */
export const recordStatusSchema = z.enum(['ACTIVE', 'FINISHED', 'DISCARDED'])
export const costTypeSchema = z.enum(COST_TYPES)
export const detailDirectionSchema = z.enum(DETAIL_DIRECTIONS)

export const createSessionReqSchema = z.object({
  serverId: idSchema.optional(),
  teamId: optionalId,
  roleId: optionalId,
  startTime: dateTimeSchema.optional()
})

export const addDetailReqSchema = z.object({
  itemId: idSchema.optional(),
  itemName: z.string().max(100).optional(),
  sourceId: optionalId,
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().int().min(0).optional(),
  direction: detailDirectionSchema.default('INCOME'),
  remark: z.string().max(200).optional()
})

export const updateDetailReqSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().int().min(0).optional(),
  sourceId: optionalId,
  remark: z.string().max(200).optional()
})

export const endSessionReqSchema = z.object({
  endTime: dateTimeSchema.optional(),
  totalSilver: z.number().int().min(0).optional(),
  belongDate: dateStrSchema.optional()
})

export const setActivityReqSchema = z.object({ sourceId: idSchema.nullable() })

export const addCostReqSchema = z.object({
  costType: costTypeSchema,
  itemId: optionalId,
  name: z.string().max(100).nullish(),
  amount: z.number().int().min(1),
  remark: z.string().max(200).nullish()
})

export const updateRecordReqSchema = z.object({
  startTime: dateTimeSchema.optional(),
  endTime: dateTimeSchema.optional(),
  totalSilver: z.number().int().min(0).optional(),
  belongDate: dateStrSchema.optional()
})

/* ---------- 统计 ---------- */
export const cycleTypeSchema = z.enum(CYCLE_TYPES)
export const rangeTypeSchema = z.enum(RANGE_TYPES)

/* ---------- 设置 ---------- */
export const updateSettingsReqSchema = z.object({
  defaultServerId: optionalId,
  defaultTeamId: optionalId,
  autoDateCorrect: z.boolean().optional(),
  onboardingDone: z.boolean().optional(),
  updateRepo: z
    .string()
    .trim()
    .regex(/^$|^[\w.-]+\/[\w.-]+$/, '仓库地址格式应为 owner/repo')
    .optional(),
  closeToTray: z.boolean().optional()
})

/* ---------- 通用 ---------- */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20)
})
