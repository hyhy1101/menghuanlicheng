export type ThemeMode = 'dark' | 'light'
/**
 * 界面风格（主题）。
 *
 * - neumorphic 主题一：新拟物。元素与背景同色，层级只靠一对明暗阴影表达，
 *   全站只有主行动允许压在基底上的饱和色。默认风格，暗色开关可用。
 * - soft 主题二：柔和界面风。雾灰画布 + 纯白卡片、彩色柔光阴影、低饱和配色，
 *   交互靠「浮起」表达。规范只给了亮色取值，所以这个风格下显示模式锁在亮色、
 *   主题色固定靛蓝。
 */
export type ThemeStyle = 'neumorphic' | 'soft'

/** 新拟物只有一束光，压在基底上的饱和色只留给主行动，所以主题色限定在
 * 四支高饱和紫/蓝/青/洋红里，避免暖色系把冷灰材质压成脏色。
 * 默认紫罗兰定义在 App.vue 的 :root 里，没有对应的 data-accent 块。
 */
export type ThemeAccent = 'violet' | 'indigo' | 'teal' | 'rose'

export const THEME_ACCENTS: { id: ThemeAccent; name: string; colors: [string, string, string] }[] = [
  { id: 'violet', name: '紫罗兰', colors: ['#8e80fd', '#6d5dfc', '#5a49e8'] },
  { id: 'indigo', name: '靛蓝', colors: ['#7d9aff', '#4c6ef5', '#3b57d4'] },
  { id: 'teal', name: '青碧', colors: ['#2fb3a7', '#0e9488', '#0a7a70'] },
  { id: 'rose', name: '洋红', colors: ['#e4638f', '#d6336c', '#b7275a'] }
]

export const THEME_STYLES: { id: ThemeStyle; name: string; desc: string }[] = [
  { id: 'neumorphic', name: '主题一', desc: '新拟物' },
  { id: 'soft', name: '主题二', desc: '柔和界面风' }
]
