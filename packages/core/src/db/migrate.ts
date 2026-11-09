import type { Client } from '@libsql/client'

/**
 * 手写迁移：按 PRAGMA user_version 顺序执行。
 *
 * 不用 drizzle-kit 生成的迁移：离线包里只需要「建表 + 以后偶尔加列」，
 * 一个数组比一套 meta/_journal.json 好读也好改。新增结构时**只追加**，永不修改已发布的条目。
 */
const MIGRATIONS: string[] = [
  // v1：初始结构
  `
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY,
    nickname TEXT NOT NULL DEFAULT '玩家',
    avatar TEXT,
    create_time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    default_server_id INTEGER,
    default_team_id INTEGER,
    auto_date_correct INTEGER NOT NULL DEFAULT 1,
    onboarding_done INTEGER NOT NULL DEFAULT 0,
    update_repo TEXT NOT NULL DEFAULT '',
    close_to_tray INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS game_server (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'OPEN',
    card_price INTEGER NOT NULL DEFAULT 12800,
    remark TEXT,
    create_time TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uk_server_name ON game_server(name);

  CREATE TABLE IF NOT EXISTS item_category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uk_item_category_code ON item_category(code);

  CREATE TABLE IF NOT EXISTS game_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pinyin TEXT NOT NULL DEFAULT '',
    category_id INTEGER NOT NULL,
    level TEXT NOT NULL DEFAULT '',
    icon_url TEXT,
    is_common INTEGER NOT NULL DEFAULT 0,
    is_fixed_price INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    create_time TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uk_item_name ON game_item(name);
  CREATE INDEX IF NOT EXISTS idx_item_category ON game_item(category_id);
  CREATE INDEX IF NOT EXISTS idx_item_pinyin ON game_item(pinyin);

  CREATE TABLE IF NOT EXISTS item_price (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    server_id INTEGER NOT NULL,
    merchant_price INTEGER,
    personal_price INTEGER,
    user_price INTEGER,
    update_time TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uk_item_price_item_server ON item_price(item_id, server_id);

  CREATE TABLE IF NOT EXISTS game_source (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'ACTIVITY',
    level INTEGER,
    duration_desc TEXT,
    rules TEXT NOT NULL DEFAULT '[]',
    intro TEXT,
    remind_enabled INTEGER NOT NULL DEFAULT 1,
    remind_before INTEGER NOT NULL DEFAULT 10,
    remind_at_start INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ENABLED',
    create_time TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uk_source_name ON game_source(name);
  CREATE INDEX IF NOT EXISTS idx_source_type ON game_source(type);

  CREATE TABLE IF NOT EXISTS game_team (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    server_id INTEGER NOT NULL,
    create_time TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uk_team_name ON game_team(name);
  CREATE INDEX IF NOT EXISTS idx_team_server ON game_team(server_id);

  CREATE TABLE IF NOT EXISTS game_role (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER,
    server_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    sect TEXT NOT NULL DEFAULT '',
    deleted INTEGER NOT NULL DEFAULT 0,
    create_time TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_role_team ON game_role(team_id);
  CREATE INDEX IF NOT EXISTS idx_role_server ON game_role(server_id);

  CREATE TABLE IF NOT EXISTS mileage_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER,
    role_id INTEGER,
    server_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    role_count INTEGER NOT NULL DEFAULT 1,
    current_source_id INTEGER,
    total_silver INTEGER NOT NULL DEFAULT 0,
    item_sum INTEGER NOT NULL DEFAULT 0,
    total_income INTEGER NOT NULL,
    card_price INTEGER NOT NULL DEFAULT 12800,
    card_cost INTEGER NOT NULL DEFAULT 0,
    loss_total INTEGER NOT NULL DEFAULT 0,
    net_income INTEGER NOT NULL,
    efficiency INTEGER NOT NULL DEFAULT 0,
    net_efficiency INTEGER NOT NULL DEFAULT 0,
    belong_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    create_time TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_record_belong ON mileage_record(belong_date);
  CREATE INDEX IF NOT EXISTS idx_record_team ON mileage_record(team_id);
  CREATE INDEX IF NOT EXISTS idx_record_role ON mileage_record(role_id);
  CREATE INDEX IF NOT EXISTS idx_record_status ON mileage_record(status);

  CREATE TABLE IF NOT EXISTS mileage_record_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    item_id INTEGER,
    item_name TEXT,
    source_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL,
    item_value INTEGER NOT NULL,
    direction TEXT NOT NULL DEFAULT 'INCOME',
    remark TEXT,
    create_time TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_detail_record ON mileage_record_detail(record_id);
  CREATE INDEX IF NOT EXISTS idx_detail_item ON mileage_record_detail(item_id);

  CREATE TABLE IF NOT EXISTS cost_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    cost_type TEXT NOT NULL,
    item_id INTEGER,
    name TEXT,
    amount INTEGER NOT NULL,
    remark TEXT,
    create_time TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cost_record ON cost_record(record_id);

  CREATE TABLE IF NOT EXISTS income_daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_date TEXT NOT NULL,
    total_income INTEGER NOT NULL DEFAULT 0,
    net_income INTEGER NOT NULL DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    record_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uk_daily_date ON income_daily_stats(stat_date);
  `
]

export async function migrate(client: Client): Promise<void> {
  const res = await client.execute('PRAGMA user_version')
  const current = Number(res.rows[0]?.user_version ?? 0)
  for (let i = current; i < MIGRATIONS.length; i++) {
    const tx = await client.transaction('write')
    try {
      await tx.executeMultiple(MIGRATIONS[i])
      await tx.execute(`PRAGMA user_version = ${i + 1}`)
      await tx.commit()
    } catch (err) {
      await tx.rollback()
      throw err
    }
  }
}
