export type ThemeMode = 'dark' | 'light'
/**
 * 四个大地色主色，与官网（Natural Organic）同一家族。
 * 去掉了原来的「冰蓝 / 紫罗兰」——自然有机风禁止冷色调（蓝紫仅可作辅助）。
 * 注意：sage 是默认值，它定义在 App.vue 的 :root 里，所以没有对应的 data-accent 块。
 */
export type ThemeAccent = 'sage' | 'terracotta' | 'olive' | 'amber'

export const THEME_ACCENTS: { id: ThemeAccent; name: string; colors: [string, string, string] }[] = [
  { id: 'sage', name: '鼠尾草', colors: ['#a3b28f', '#8b9d77', '#71835f'] },
  { id: 'terracotta', name: '赤陶', colors: ['#c07a5e', '#a8563f', '#8a4432'] },
  { id: 'olive', name: '橄榄', colors: ['#93a273', '#7a8a5a', '#62704a'] },
  { id: 'amber', name: '琥珀', colors: ['#dcae63', '#c89640', '#a97a2c'] }
]
