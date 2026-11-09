import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'
import electronPath from 'electron'

/**
 * 开发模式：先编主进程，再等 Vite 起来，然后拉起 Electron。
 * Vite 由根目录的 `pnpm dev` 并行启动（见根 package.json）。
 */
await new Promise((resolve, reject) => {
  const p = spawn(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' })
  p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('build failed'))))
})

function portOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' })
    sock.once('connect', () => {
      sock.destroy()
      resolve(true)
    })
    sock.once('error', () => resolve(false))
  })
}

for (let i = 0; i < 60; i++) {
  if (await portOpen(5174)) break
  await sleep(500)
}

const bin = typeof electronPath === 'string' ? electronPath : null
if (!bin || !existsSync(bin)) {
  console.error('未找到 Electron 可执行文件，先跑 pnpm install')
  process.exit(1)
}

const child = spawn(bin, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, LC_DEV: '1' }
})
child.on('exit', (code) => process.exit(code ?? 0))
