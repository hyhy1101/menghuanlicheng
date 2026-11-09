import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

const outdir = 'dist'
mkdirSync(outdir, { recursive: true })

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info',
  external: ['electron', '@libsql/client', '@libsql/*']
}

await build({
  ...shared,
  entryPoints: ['electron/main.ts'],
  outfile: 'dist/main.cjs',
  // 主进程用 CommonJS 输出：Electron 的 preload 必须是 CJS，主进程同格式免去 ESM 实验开关
  banner: { js: '// 梦幻里程 主进程（由 esbuild 打包）' }
})

await build({
  ...shared,
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist/preload.cjs'
})

console.log('desktop build done')
