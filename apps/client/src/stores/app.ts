import { defineStore } from 'pinia'
import { settingsApi } from '../api/basic'
import type { AppInfo } from '../types/bridge'
import type { UserSettingsDTO } from '@lc/shared'

export const useAppStore = defineStore('app', {
  state: () => ({
    settings: null as UserSettingsDTO | null,
    info: null as AppInfo | null,
    loaded: false
  }),
  actions: {
    /** 路由守卫会调；只取一次，之后由 setSettings 维护 */
    async ensureSettings(): Promise<UserSettingsDTO | null> {
      if (this.loaded) return this.settings
      try {
        const { data } = await settingsApi.get()
        this.settings = data.data
      } catch (e) {
        console.error('[settings]', e)
        this.settings = null
      }
      this.loaded = true
      return this.settings
    },
    setSettings(s: UserSettingsDTO) {
      this.settings = s
      this.loaded = true
    },
    async saveSettings(patch: Partial<UserSettingsDTO>): Promise<UserSettingsDTO> {
      const { data } = await settingsApi.update(patch)
      this.setSettings(data.data)
      return data.data
    },
    async loadInfo(): Promise<AppInfo | null> {
      if (this.info) return this.info
      try {
        this.info = await window.lc.info()
      } catch (e) {
        console.error('[info]', e)
      }
      return this.info
    }
  }
})
