#!/usr/bin/env node
/**
 * 提交门禁：仓库里绝不允许出现数据文件。
 *
 * 真实用户数据（账号、手机号、OpenID、登录日志、号组、物品成交价）只存在本机
 * userData 目录，任何一份导出 CSV 一旦入仓就等于永久泄露（force-push 也删不干净）。
 *
 * 用法：
 *   node scripts/check-no-data.mjs          # 检查 git 已跟踪的文件
 *   node scripts/check-no-data.mjs --all    # 额外扫描工作区里未跟踪的数据文件
 *
 * 退出码 1 表示命中，可直接挂到 CI / pre-commit。
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const DATA_RE = /\.(csv|tsv|xlsx?|sql|dump|db|sqlite3?|db-wal|db-shm|sqlite-wal|sqlite-shm)$/i
const DATA_DIR_RE = /(^|\/)(sql|data|backups)\//
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'release', 'out', '.cache'])

function gitTracked() {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function walk(dir, root, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, root, acc)
    else acc.push(relative(root, full).replace(/\\/g, '/'))
  }
  return acc
}

const tracked = gitTracked()
const offenders = tracked.filter((p) => DATA_RE.test(p) || DATA_DIR_RE.test(p))

if (process.argv.includes('--all')) {
  for (const p of walk(process.cwd(), process.cwd())) {
    if ((DATA_RE.test(p) || DATA_DIR_RE.test(p)) && !offenders.includes(p)) offenders.push(p)
  }
}

if (offenders.length) {
  console.error('✗ 检测到数据文件，禁止提交：')
  for (const p of offenders) console.error('  - ' + p)
  console.error('\n真实用户数据不得入库。请删除这些文件，并确认 .gitignore 已覆盖。')
  process.exit(1)
}

console.log('✓ 未发现数据文件（csv/tsv/xlsx/sql/db/sqlite 及 sql、data、backups 目录）')
