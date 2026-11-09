import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import App from './App.vue'
import { router } from './router'
import { useThemeStore } from './stores/theme'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
useThemeStore(pinia).apply()

// 单机版没有要等的外部地址：数据库由主进程在启动时打开，渲染层直接挂载。
app.use(ElementPlus, { locale: zhCn }).use(router)
app.mount('#app')
