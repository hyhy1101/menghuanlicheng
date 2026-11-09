export type ThemeMode = 'dark' | 'light'
/**
 * 新拟物只有一束光，压在基底上的饱和色只留给主行动，所以主题色限定在
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
