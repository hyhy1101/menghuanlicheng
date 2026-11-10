import { defineStore } from 'pinia'
import { profileApi, settingsApi } from '../api/basic'
import type { AppInfo } from '../types/bridge'
import type { ProfileDTO, UserSettingsDTO } from '@lc/shared'

export const useAppStore = defineStore('app', {
  state: () => ({
    settings: null as UserSettingsDTO | null,
    /**
     * 本地档案放 store 里共享：顶栏和设置页都读它，
     * 否则在设置页改昵称、或一键初始化把档案复位后，顶栏会一直显示旧昵称。
     */
    profile: null as ProfileDTO | null,
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
    /** 读档案；force = 数据改过之后强制重取 */
    async loadProfile(force = false): Promise<ProfileDTO | null> {
      if (this.profile && !force) return this.profile
      try {
        const { data } = await profileApi.get()
        this.profile = data.data
      } catch (e) {
        console.error('[profile]', e)
      }
      return this.profile
    },
    setProfile(p: ProfileDTO) {
      this.profile = p
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
