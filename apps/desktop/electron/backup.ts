import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BACKUP_KEEP } from '@lc/shared'
import type { Client } from '@libsql/client'

/**
 * 备份策略：每天第一次启动留一份，滚动保留 BACKUP_KEEP 份。
 *
 * 用 SQLite 的 VACUUM INTO 而不是直接拷文件：WAL 模式下 data.db 单独拷出来可能
 * 缺最近的事务；VACUUM INTO 导出的是一个完整、已整理的自包含库。
 */

export interface BackupFile {
  name: string
  path: string
  size: number
  time: string
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

function quote(path: string): string {
  return `'${path.replace(/'/g, "''").replace(/\\/g, '/')}'`
}

export async function backupDaily(client: Client, backupDir: string): Promise<string | null> {
  mkdirSync(backupDir, { recursive: true })
  const file = join(backupDir, `data-${stamp()}.db`)
  if (existsSync(file)) return null
  await client.execute(`VACUUM INTO ${quote(file)}`)
  prune(backupDir)
  return file
}

export function prune(backupDir: string): void {
  const files = listBackups(backupDir)
  for (const f of files.slice(BACKUP_KEEP)) {
    try {
      unlinkSync(f.path)
    } catch {
      /* 删不掉就留着，不影响使用 */
    }
  }
}

export function listBackups(backupDir: string): BackupFile[] {
  if (!existsSync(backupDir)) return []
  return readdirSync(backupDir)
    .filter((n) => /^data-\d{8}\.db$/.test(n))
    .map((name) => {
      const path = join(backupDir, name)
      const st = statSync(path)
      return {
        name,
        path,
        size: st.size,
        time: `${name.slice(5, 9)}-${name.slice(9, 11)}-${name.slice(11, 13)} ${st.mtime.toTimeString().slice(0, 5)}`
      }
    })
    .sort((a, b) => b.name.localeCompare(a.name))
}

/** 手动导出一份到用户选的位置 */
export async function exportBackup(client: Client, target: string): Promise<void> {
  if (existsSync(target)) unlinkSync(target)
  await client.execute(`VACUUM INTO ${quote(target)}`)
}

/**
 * 从备份恢复。调用方负责先关闭当前库连接，恢复后重启应用。
 * 恢复前会把当前库另存为 data-before-restore.db，避免误操作丢数据。
 */
export function restoreBackup(backupPath: string, dbFile: string): void {
  if (!existsSync(backupPath)) throw new Error('备份文件不存在')
  const dir = dirname(dbFile)
  const safety = join(dir, 'data-before-restore.db')
  if (existsSync(dbFile) && !existsSync(safety)) copyFileSync(dbFile, safety)
  copyFileSync(backupPath, dbFile)
  for (const suffix of ['-wal', '-shm']) {
    const f = dbFile + suffix
    if (existsSync(f)) unlinkSync(f)
  }
}
