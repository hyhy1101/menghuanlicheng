import { defineStore } from 'pinia'
import { THEME_ACCENTS } from '../themes'
import type { ThemeAccent, ThemeMode } from '../themes'

interface ThemeState {
  mode: ThemeMode
  accent: ThemeAccent
}

const STORAGE_KEY = 'lc_theme'
/*
 * 默认亮色 + 紫罗兰：新拟物以亮色为基准（暗色只是保留的备选）。
 * 老用户 localStorage 里可能还是 accent:'sage'/'gold'，已不在 THEME_ACCENTS 里，
 * load() 的 isAccent 校验会让它整体回落到这里的默认值。
 */
const DEFAULT_THEME: ThemeState = { mode: 'light', accent: 'violet' }

function isAccent(v: unknown): v is ThemeAccent {
  return THEME_ACCENTS.some((t) => t.id === v)
}

function load(): ThemeState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ThemeState> | null
    if (raw && (raw.mode === 'dark' || raw.mode === 'light') && isAccent(raw.accent)) {
      return { mode: raw.mode, accent: raw.accent }
    }
  } catch {
    /* 忽略损坏数据 */
  }
  return { ...DEFAULT_THEME }
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => load(),
  actions: {
    apply() {
      const root = document.documentElement
      root.classList.toggle('dark', this.mode === 'dark')
      root.dataset.accent = this.accent
    },
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: this.mode, accent: this.accent }))
    },
    setMode(mode: ThemeMode) {
      this.mode = mode
      this.apply()
      this.persist()
    },
    setAccent(accent: ThemeAccent) {
      this.accent = accent
      this.apply()
      this.persist()
    },
    toggleMode() {
      this.setMode(this.mode === 'dark' ? 'light' : 'dark')
    }
  }
})
