import { defineStore } from 'pinia'
import { STYLE_FORCED_MODE, THEME_ACCENTS, THEME_STYLES } from '../themes'
import type { ThemeAccent, ThemeMode, ThemeStyle } from '../themes'

interface ThemeState {
  style: ThemeStyle
  mode: ThemeMode
  accent: ThemeAccent
}

const STORAGE_KEY = 'lc_theme'
/*
 * 默认主题一（新拟物）+ 亮色 + 紫罗兰。
 * 老用户 localStorage 里可能没有 style，或还是 accent:'sage'/'gold'（已不在
 * THEME_ACCENTS 里），load() 的校验会让它整体回落到这里的默认值。
 */
const DEFAULT_THEME: ThemeState = { style: 'neumorphic', mode: 'light', accent: 'violet' }

function isAccent(v: unknown): v is ThemeAccent {
  return THEME_ACCENTS.some((t) => t.id === v)
}

function isStyle(v: unknown): v is ThemeStyle {
  return THEME_STYLES.some((t) => t.id === v)
}

function load(): ThemeState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ThemeState> | null
    if (raw && (raw.mode === 'dark' || raw.mode === 'light') && isAccent(raw.accent)) {
      const style = isStyle(raw.style) ? raw.style : DEFAULT_THEME.style
      // 主题二只有亮色、主题三只有暗色：历史数据里的模式与规范冲突时以规范为准
      const mode = STYLE_FORCED_MODE[style] ?? raw.mode
      return { style, mode, accent: raw.accent }
    }
  } catch {
    /* 忽略损坏数据 */
  }
  return { ...DEFAULT_THEME }
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => load(),
  getters: {
    /** 主题二只提供亮色、主题三只提供暗色，显示模式开关要锁住 */
    canToggleMode: (s) => s.style === 'neumorphic',
    /** 主题二固定靛蓝、主题三固定香槟金，主题色选择器隐藏 */
    canPickAccent: (s) => s.style === 'neumorphic'
  },
  actions: {
    apply() {
      const root = document.documentElement
      root.classList.toggle('dark', this.mode === 'dark')
      root.dataset.accent = this.accent
      root.dataset.style = this.style
    },
    persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ style: this.style, mode: this.mode, accent: this.accent })
      )
    },
    setStyle(style: ThemeStyle) {
      this.style = style
      const forced = STYLE_FORCED_MODE[style]
      if (forced) this.mode = forced
      this.apply()
      this.persist()
    },
    setMode(mode: ThemeMode) {
      if (!this.canToggleMode) return
      this.mode = mode
      this.apply()
      this.persist()
    },
    setAccent(accent: ThemeAccent) {
      if (!this.canPickAccent) return
      this.accent = accent
      this.apply()
      this.persist()
    },
    toggleMode() {
      this.setMode(this.mode === 'dark' ? 'light' : 'dark')
    }
  }
})
