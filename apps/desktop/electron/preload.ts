import { contextBridge, ipcRenderer } from 'electron'

/**
 * 渲染层唯一的特权入口。只暴露领域方法，不暴露任意文件/网络/Node 能力。
 */
const api = {
  call: (method: string, path: string, body?: unknown) =>
    ipcRenderer.invoke('api:call', method, path, body),
  info: () => ipcRenderer.invoke('app:info'),
  checkUpdate: (repo: string) => ipcRenderer.invoke('app:check-update', repo),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  backup: {
    list: () => ipcRenderer.invoke('backup:list'),
    export: () => ipcRenderer.invoke('backup:export'),
    restore: (file?: string) => ipcRenderer.invoke('backup:restore', file)
  },
  saveText: (filename: string, content: string) => ipcRenderer.invoke('file:save-text', filename, content),
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('app:set-auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('app:get-auto-launch'),
  /** 托盘/通知点进来的跳转指令 */
  onNavigate: (cb: (payload: { path: string; sourceId?: number; sourceName?: string }) => void) => {
    const handler = (_e: unknown, payload: { path: string; sourceId?: number; sourceName?: string }) => cb(payload)
    ipcRenderer.on('nav', handler)
    return () => ipcRenderer.removeListener('nav', handler)
  },
  /** 系统通知不可用时的应用内横幅 */
  onActivityBanner: (cb: (payload: { sourceId: number; sourceName: string; kind: string; minutes: number }) => void) => {
    const handler = (_e: unknown, payload: { sourceId: number; sourceName: string; kind: string; minutes: number }) => cb(payload)
    ipcRenderer.on('activity-banner', handler)
    return () => ipcRenderer.removeListener('activity-banner', handler)
  }
}

contextBridge.exposeInMainWorld('lc', api)

export type LcBridge = typeof api
