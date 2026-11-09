/**
 * SQLite 数据库结构（单机离线版）。
 *
 * 约定：
 * - 时间一律存本地墙钟字符串 'YYYY-MM-DD HH:mm:ss'，日期存 'YYYY-MM-DD'。
 *   不做时区换算 —— 单机应用只有一个时区，字符串最直观，SQL 里也能直接排序/分组。
 * - 金额一律整数「两」。
 * - 布尔用 integer({ mode: 'boolean' })。
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { ActivityRule } from '@lc/shared'

/** 本地档案：单机单用户，永远只有 id = 1 一行 */
export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  nickname: text('nickname').notNull().default('玩家'),
  avatar: text('avatar'),
  createTime: text('create_time').notNull()
})

/** 全局设置：同样只有 id = 1 一行 */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  defaultServerId: integer('default_server_id'),
  defaultTeamId: integer('default_team_id'),
  autoDateCorrect: integer('auto_date_correct', { mode: 'boolean' }).notNull().default(true),
  onboardingDone: integer('onboarding_done', { mode: 'boolean' }).notNull().default(false),
  updateRepo: text('update_repo').notNull().default(''),
  closeToTray: integer('close_to_tray', { mode: 'boolean' }).notNull().default(true)
})

export const gameServers = sqliteTable(
  'game_server',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    region: text('region').notNull().default(''),
    status: text('status', { enum: ['OPEN', 'NEW', 'CLOSED'] }).notNull().default('OPEN'),
    /** 点卡单价（两/点），记录结算时取该服当时的值并写入记录快照 */
    cardPrice: integer('card_price').notNull().default(12800),
    remark: text('remark'),
    createTime: text('create_time').notNull()
  },
  (t) => [uniqueIndex('uk_server_name').on(t.name)]
)

export const itemCategories = sqliteTable(
  'item_category',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0)
  },
  (t) => [uniqueIndex('uk_item_category_code').on(t.code)]
)

export const gameItems = sqliteTable(
  'game_item',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    pinyin: text('pinyin').notNull().default(''),
    categoryId: integer('category_id').notNull(),
    level: text('level').notNull().default(''),
    /** 相对路径：items/xxx.png（内置）或 user/xxx.png（用户上传） */
    iconUrl: text('icon_url'),
    isCommon: integer('is_common', { mode: 'boolean' }).notNull().default(false),
    /** 固定价格：价格按「物品 × 服务器」维护；非固定价格每次记账现填 */
    isFixedPrice: integer('is_fixed_price', { mode: 'boolean' }).notNull().default(false),
    status: text('status', { enum: ['ENABLED', 'DISABLED'] }).notNull().default('ENABLED'),
    createTime: text('create_time').notNull()
  },
  (t) => [
    uniqueIndex('uk_item_name').on(t.name),
    index('idx_item_category').on(t.categoryId),
    index('idx_item_pinyin').on(t.pinyin)
  ]
)

/** 物品 × 服务器 三档价（仅固定价格物品维护） */
export const itemPrices = sqliteTable(
  'item_price',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    itemId: integer('item_id').notNull(),
    serverId: integer('server_id').notNull(),
    merchantPrice: integer('merchant_price'),
    personalPrice: integer('personal_price'),
    userPrice: integer('user_price'),
    updateTime: text('update_time').notNull()
  },
  (t) => [uniqueIndex('uk_item_price_item_server').on(t.itemId, t.serverId)]
)

/** 玩法 / 活动（同一张表：有 rules 的就是定时活动，可提醒） */
export const gameSources = sqliteTable(
  'game_source',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: ['DUNGEON', 'GUILD', 'ACTIVITY', 'DAILY', 'WEEKEND', 'CUSTOM'] })
      .notNull()
      .default('ACTIVITY'),
    level: integer('level'),
    durationDesc: text('duration_desc'),
    rules: text('rules', { mode: 'json' }).$type<ActivityRule[]>().notNull().default([]),
    intro: text('intro'),
    remindEnabled: integer('remind_enabled', { mode: 'boolean' }).notNull().default(true),
    remindBefore: integer('remind_before').notNull().default(10),
    remindAtStart: integer('remind_at_start', { mode: 'boolean' }).notNull().default(true),
    status: text('status', { enum: ['ENABLED', 'DISABLED'] }).notNull().default('ENABLED'),
    createTime: text('create_time').notNull()
  },
  (t) => [uniqueIndex('uk_source_name').on(t.name), index('idx_source_type').on(t.type)]
)

export const gameTeams = sqliteTable(
  'game_team',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    serverId: integer('server_id').notNull(),
    createTime: text('create_time').notNull()
  },
  (t) => [uniqueIndex('uk_team_name').on(t.name), index('idx_team_server').on(t.serverId)]
)

export const gameRoles = sqliteTable(
  'game_role',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    teamId: integer('team_id'),
    serverId: integer('server_id').notNull(),
    name: text('name').notNull(),
    level: integer('level').notNull().default(0),
    sect: text('sect').notNull().default(''),
    deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
    createTime: text('create_time').notNull()
  },
  (t) => [index('idx_role_team').on(t.teamId), index('idx_role_server').on(t.serverId)]
)

export const mileageRecords = sqliteTable(
  'mileage_record',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    teamId: integer('team_id'),
    roleId: integer('role_id'),
    serverId: integer('server_id').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    roleCount: integer('role_count').notNull().default(1),
    currentSourceId: integer('current_source_id'),
    totalSilver: integer('total_silver').notNull().default(0),
    itemSum: integer('item_sum').notNull().default(0),
    totalIncome: integer('total_income').notNull(),
    /** 结算时的点卡单价快照 */
    cardPrice: integer('card_price').notNull().default(12800),
    cardCost: integer('card_cost').notNull().default(0),
    lossTotal: integer('loss_total').notNull().default(0),
    netIncome: integer('net_income').notNull(),
    efficiency: integer('efficiency').notNull().default(0),
    netEfficiency: integer('net_efficiency').notNull().default(0),
    belongDate: text('belong_date').notNull(),
    status: text('status', { enum: ['ACTIVE', 'FINISHED', 'DISCARDED'] })
      .notNull()
      .default('ACTIVE'),
    createTime: text('create_time').notNull()
  },
  (t) => [
    index('idx_record_belong').on(t.belongDate),
    index('idx_record_team').on(t.teamId),
    index('idx_record_role').on(t.roleId),
    index('idx_record_status').on(t.status)
  ]
)

export const mileageRecordDetails = sqliteTable(
  'mileage_record_detail',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recordId: integer('record_id').notNull(),
    itemId: integer('item_id'),
    itemName: text('item_name'),
    sourceId: integer('source_id'),
    quantity: integer('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull(),
    itemValue: integer('item_value').notNull(),
    direction: text('direction', { enum: ['INCOME', 'COST'] }).notNull().default('INCOME'),
    remark: text('remark'),
    createTime: text('create_time').notNull()
  },
  (t) => [index('idx_detail_record').on(t.recordId), index('idx_detail_item').on(t.itemId)]
)

export const costRecords = sqliteTable(
  'cost_record',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recordId: integer('record_id').notNull(),
    costType: text('cost_type', { enum: ['CARD', 'LOSS'] }).notNull(),
    itemId: integer('item_id'),
    name: text('name'),
    amount: integer('amount').notNull(),
    remark: text('remark'),
    createTime: text('create_time').notNull()
  },
  (t) => [index('idx_cost_record').on(t.recordId)]
)

export const incomeDailyStats = sqliteTable(
  'income_daily_stats',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    statDate: text('stat_date').notNull(),
    totalIncome: integer('total_income').notNull().default(0),
    netIncome: integer('net_income').notNull().default(0),
    durationMinutes: integer('duration_minutes').notNull().default(0),
    recordCount: integer('record_count').notNull().default(0)
  },
  (t) => [uniqueIndex('uk_daily_date').on(t.statDate)]
)
