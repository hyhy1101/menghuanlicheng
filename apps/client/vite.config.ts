import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 相对基址：打包后页面跑在 file:// 下，绝对 '/' 会解析到磁盘根，窗口直接白屏。
  // 单机版没有 API 代理 —— 请求全部走 IPC，见 src/api/http.ts。
  base: './',
  server: {
    port: 5174,
    strictPort: true
  }
})
