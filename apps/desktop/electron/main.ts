import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { callApi, initLocalDb, type ApiResponse, type DbHandle } from '@lc/core'
import type { ActivityOccurrenceDTO, GameSourceDTO, UserSettingsDTO } from '@lc/shared'
import { backupDaily, exportBackup, listBackups, restoreBackup } from './backup.js'
import { handleImageProtocol, registerImageScheme } from './image.js'
import { startReminders, stopReminders } from './notify.js'
import { checkUpdate } from './update.js'

const isDev = !app.isPackaged
const appRoot = app.getAppPath()

let win: BrowserWindow | null = null
let tray: Tray | null = null
let dbHandle: DbHandle | null = null
let quitting = false
let settingsCache: UserSettingsDTO | null = null

const userDataDir = app.getPath('userData')
const dbFile = join(userDataDir, 'data.db')
const imagesDir = join(userDataDir, 'images')
const backupDir = join(userDataDir, 'backups')
/** 开发态读 apps/client/public，打包后读 app.asar/renderer */
const assetsDir = isDev ? join(appRoot, '..', 'client', 'public') : join(appRoot, 'renderer')

registerImageScheme()

/* ---------------- 窗口 ---------------- */

function showWindow(): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
}

function openRecordForActivity(occ: ActivityOccurrenceDTO): void {
  showWindow()
  win?.webContents.send('nav', {
    path: '/record',
    sourceId: occ.sourceId,
    sourceName: occ.sourceName
  })
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: '#f6f1e6',
    autoHideMenuBar: true,
    title: '梦幻里程',
    icon: join(appRoot, 'build', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => win?.show())

  win.on('close', (e) => {
    if (quitting) return
    if (settingsCache?.closeToTray !== false) {
      e.preventDefault()
      win?.hide()
    }
  })

  win.on('closed', () => {
    win = null
  })

  if (isDev) {
    void win.loadURL('http://localhost:5174')
  } else {
    void win.loadFile(join(appRoot, 'renderer', 'index.html'))
  }
}

/* ---------------- 托盘 ---------------- */

function createTray(): void {
  const icon = nativeImage.createFromPath(join(appRoot, 'build', 'tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('梦幻里程')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开主界面', click: showWindow },
      {
        label: '今日活动',
        click: () => {
          showWindow()
          win?.webContents.send('nav', { path: '/activities' })
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true
          stopReminders()
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showWindow)
  tray.on('double-click', showWindow)
}

/* ---------------- IPC ---------------- */

async function loadSettings(): Promise<UserSettingsDTO> {
  const res = await callApi<UserSettingsDTO>('GET', '/api/v1/settings')
  settingsCache = res.data
  return res.data
}

function registerIpc(): void {
  ipcMain.handle(
    'api:call',
    async (_e, method: string, path: string, body?: unknown): Promise<ApiResponse | { ok: false; code: number; msg: string; data?: unknown }> => {
      try {
        const res = await callApi(method, path, body)
        // 设置变更后立刻刷新托盘/关闭行为用的缓存，不等下次启动
        if (method === 'PUT' && path.startsWith('/api/v1/settings')) {
          settingsCache = res.data as UserSettingsDTO
        }
        return res
      } catch (err) {
        const e = err as Error & { code?: number; data?: unknown }
        return { ok: false, code: e.code ?? 500, msg: e.message || '操作失败', data: e.data }
      }
    }
  )

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    isDev,
    userData: userDataDir,
    dbFile,
    backupDir
  }))

  ipcMain.handle('app:check-update', async (_e, repo: string) => {
    try {
      return { ok: true, data: await checkUpdate(repo) }
    } catch (err) {
      return { ok: false, msg: (err as Error).message }
    }
  })

  ipcMain.handle('app:open-external', async (_e, url: string) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return { ok: false, msg: '链接格式不对' }
    }
    if (parsed.protocol !== 'https:' || !/(^|\.)github\.com$/.test(parsed.hostname)) {
      return { ok: false, msg: '只允许打开 GitHub 链接' }
    }
    await shell.openExternal(parsed.toString())
    return { ok: true }
  })

  ipcMain.handle('backup:list', () => listBackups(backupDir))

  ipcMain.handle('backup:export', async () => {
    if (!dbHandle) return { ok: false, msg: '数据库未就绪' }
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const suggested = `梦幻里程-备份-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.db`
    const res = await dialog.showSaveDialog(win!, {
      title: '导出备份',
      defaultPath: suggested,
      filters: [{ name: '备份文件', extensions: ['db'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, msg: '已取消' }
    try {
      await exportBackup(dbHandle.client, res.filePath)
      return { ok: true, data: res.filePath }
    } catch (err) {
      return { ok: false, msg: (err as Error).message }
    }
  })

  ipcMain.handle('backup:restore', async (_e, file?: string) => {
    if (!dbHandle) return { ok: false, msg: '数据库未就绪' }
    let target = file
    if (!target) {
      const res = await dialog.showOpenDialog(win!, {
        title: '选择要恢复的备份',
        properties: ['openFile'],
        filters: [{ name: '备份文件', extensions: ['db'] }]
      })
      if (res.canceled || res.filePaths.length === 0) return { ok: false, msg: '已取消' }
      target = res.filePaths[0]
    }
    const confirm = await dialog.showMessageBox(win!, {
      type: 'warning',
      buttons: ['取消', '恢复并重启'],
      defaultId: 0,
      cancelId: 0,
      title: '从备份恢复',
      message: '恢复会用备份覆盖当前全部数据。',
      detail: '当前数据会另存为 data-before-restore.db，应用随后自动重启。'
    })
    if (confirm.response !== 1) return { ok: false, msg: '已取消' }

    try {
      stopReminders()
      await dbHandle.client.close()
      restoreBackup(target, dbFile)
      quitting = true
      app.relaunch()
      app.exit(0)
      return { ok: true }
    } catch (err) {
      return { ok: false, msg: (err as Error).message }
    }
  })

  ipcMain.handle('file:save-text', async (_e, filename: string, content: string) => {
    const res = await dialog.showSaveDialog(win!, {
      title: '导出文件',
      defaultPath: filename,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, msg: '已取消' }
    try {
      // BOM：Excel 直接双击打开时中文才不乱码
      writeFileSync(res.filePath, '﻿' + content, 'utf8')
      return { ok: true, data: res.filePath }
    } catch (err) {
      return { ok: false, msg: (err as Error).message }
    }
  })

  ipcMain.handle('app:set-auto-launch', (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
    return { ok: true }
  })

  ipcMain.handle('app:get-auto-launch', () => app.getLoginItemSettings().openAtLogin)
}

/* ---------------- 启动 ---------------- */

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)

  app.whenReady().then(async () => {
    if (process.platform === 'win32') app.setAppUserModelId('com.menghuanlicheng.ledger')
    Menu.setApplicationMenu(null)

    dbHandle = await initLocalDb({ userData: userDataDir, images: imagesDir, assets: assetsDir }, dbFile)
    handleImageProtocol(imagesDir, assetsDir)

    // 每天第一次启动留一份备份；失败不阻塞启动（比如磁盘满）
    backupDaily(dbHandle.client, backupDir).catch((err) => console.error('[backup]', err))

    try {
      await loadSettings()
    } catch (err) {
      console.error('[settings]', err)
    }

    registerIpc()
    createWindow()
    createTray()

    startReminders({
      loadSources: async () => (await callApi<GameSourceDTO[]>('GET', '/api/v1/sources?status=ENABLED')).data,
      onOpen: openRecordForActivity,
      onRemind: (banner) => {
        // 系统通知没弹出来（平台不支持）时，只能把窗口叫起来看应用内横幅
        if (!banner.osShown) showWindow()
        win?.webContents.send('activity-banner', banner)
      }
    })
  })

  app.on('before-quit', () => {
    quitting = true
  })

  // 关窗不退出：托盘常驻，活动提醒才能按时响
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') return
    app.quit()
  })
}
