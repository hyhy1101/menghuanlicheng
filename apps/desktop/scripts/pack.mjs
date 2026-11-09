import { spawn } from 'node:child_process'

/**
 * 打 Windows x64 安装包（NSIS）。前置：根目录 pnpm build 已生成 renderer 与 dist。
 *
 * extraMetadata.name：electron-builder 在安装目录名上只接受 ASCII 的 productName，
 * 中文会被丢弃并退回 package.json 的 name（"@lc/desktop" → "@lcdesktop"）。
 * 这里把打包进 app.asar 的 name 覆盖成 menghuanlicheng，安装目录才是
 * %LOCALAPPDATA%\Programs\menghuanlicheng，而不是 "@lcdesktop"。
 * 界面名、进程名、用户数据目录仍由 productName（梦幻里程）决定。
 */
const p = spawn(
  'npx',
  ['electron-builder', '--win', '--x64', '--config.extraMetadata.name=menghuanlicheng'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
)
p.on('exit', (code) => process.exit(code ?? 0))
